import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../store/index.js';
import { signup } from '../account.js';
import { contextFor, createInvite, acceptInvite } from '../orgs.js';
import { billingConfig } from './config.js';
import { createCheckoutSession } from './stripe.js';
import { handleStripeEvent, type StripeEvent } from './webhook.js';
import {
  accessLevel, checkEntitlement, levelAllows, paymentHistory, readEntitlements, RENEWAL_GRACE_MS, sectionAccess, subscriptionState, SECTION_LEVEL,
} from '../entitlements.js';
import { saveAssessment } from '../assessments.js';
import { readOrgProfile, readRiskEdits, renameOrg, saveOrgProfile, saveRiskEdit } from '../workspace-data.js';

const SECRET = 'whsec_test_secret_abcdefghijklmnop';
const ENV = { BILLING_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_ASSESSMENT: 'price_as', STRIPE_PRICE_BLUEPRINT: 'price_bp', STRIPE_PRICE_TEAM_MONTHLY: 'price_team', APP_URL: 'https://teams.example' };
const cfg = billingConfig(ENV);
const PW = 'correct horse battery staple';
const SNAP = { verdict: 'assisted', outcome: 'buy_ai', pattern: 'hybrid-human-loop', decisionInputHash: 'a'.repeat(64), engines: {} };
const T0 = 1_700_000_000; // in the past, so checks that use the real clock see ended subscriptions as ended

function ev(id: string, type: string, object: Record<string, unknown>, created = T0): StripeEvent {
  return { id, type, created, livemode: false, data: { object } };
}

async function setup() {
  const store = new MemoryStore();
  const u = await signup(store, { email: `o${Math.random()}@x.io`, password: PW, name: 'Owner' });
  const ctx = await contextFor(store, u.id, u.personalOrgId);
  const rec = await saveAssessment(store, ctx, { title: 'Triage', workload: { id: 'w' }, snapshot: SNAP });
  return { store, u, ctx, rec, orgId: u.personalOrgId };
}

const paid = (orgId: string, product: string, rootId: string | undefined, session: string, intent = `pi_${session}`) => ({
  id: session, payment_status: 'paid', amount_total: product === 'assessment' ? 14900 : 39900, currency: 'usd', payment_intent: intent,
  metadata: { orgId, product, ...(rootId ? { assessmentRootId: rootId } : {}) },
});

describe('assessment and blueprint purchases', () => {
  test('checkout for an assessment uses its price and copies metadata onto the payment', async () => {
    const { u, rec } = await setup();
    let body: URLSearchParams | null = null;
    const f = (async (_u: unknown, init?: RequestInit) => { body = new URLSearchParams(String(init!.body)); return new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/x' })); }) as typeof fetch;
    await createCheckoutSession(cfg, { product: 'assessment', orgId: u.personalOrgId, userId: u.id, email: u.email, assessmentRootId: rec.rootId, idempotencyKey: 'k' }, f);
    assert.equal(body!.get('line_items[0][price]'), 'price_as');
    assert.equal(body!.get('payment_intent_data[metadata][assessmentRootId]'), rec.rootId);
    await assert.rejects(createCheckoutSession(cfg, { product: 'assessment', orgId: u.personalOrgId, userId: u.id, email: u.email, idempotencyKey: 'k2' }, f));
  });

  test('levels: free, then assessment, then blueprint; sections follow the level', async () => {
    const { store, orgId, ctx, rec } = await setup();
    assert.equal((await sectionAccess(store, ctx, cfg, rec.rootId)).level, 'free');
    await handleStripeEvent(store, ev('e1', 'checkout.session.completed', paid(orgId, 'assessment', rec.rootId, 'cs_a')), { expectLivemode: false });
    assert.equal((await sectionAccess(store, ctx, cfg, rec.rootId)).level, 'assessment');
    assert.ok(levelAllows('assessment', 'risks') && !levelAllows('assessment', 'architecture'));
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, false, 'an assessment purchase does not include the blueprint');
    await handleStripeEvent(store, ev('e2', 'checkout.session.completed', paid(orgId, 'blueprint', rec.rootId, 'cs_b')), { expectLivemode: false });
    assert.equal((await sectionAccess(store, ctx, cfg, rec.rootId)).level, 'blueprint');
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, true);
    assert.equal((await sectionAccess(store, ctx, cfg, 'asm_other')).level, 'free', 'a purchase unlocks only its own assessment');
  });

  test('billing off opens every section, and the anonymous report gets the free sections only when billing is on', async () => {
    const { store, ctx, rec } = await setup();
    assert.equal((await sectionAccess(store, ctx, billingConfig({}), rec.rootId)).level, 'blueprint');
    assert.equal((await sectionAccess(null, null, cfg, null)).level, 'free');
    assert.equal(Object.values(SECTION_LEVEL).filter((l) => l === 'free').length, 2);
  });

  test('duplicate checkout events grant once and record one payment', async () => {
    const { store, orgId, rec } = await setup();
    const e = ev('e_dup', 'checkout.session.completed', paid(orgId, 'blueprint', rec.rootId, 'cs_d'));
    assert.equal((await handleStripeEvent(store, e, { expectLivemode: false })).status, 'processed');
    assert.equal((await handleStripeEvent(store, e, { expectLivemode: false })).status, 'duplicate');
    // Same session, new event id (Stripe sends completed and async_payment_succeeded for some methods).
    await handleStripeEvent(store, ev('e_dup2', 'checkout.session.async_payment_succeeded', paid(orgId, 'blueprint', rec.rootId, 'cs_d')), { expectLivemode: false });
    const ent = await readEntitlements(store, orgId);
    assert.equal(ent.purchases.length, 1);
    assert.equal(ent.payments!.filter((p) => p.status === 'paid').length, 1);
  });

  test('a full refund revokes the purchase; a partial refund does not', async () => {
    const { store, orgId, ctx, rec } = await setup();
    await handleStripeEvent(store, ev('e1', 'checkout.session.completed', paid(orgId, 'blueprint', rec.rootId, 'cs_r', 'pi_r')), { expectLivemode: false });
    const partial = await handleStripeEvent(store, ev('e2', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_r', refunded: false, amount_refunded: 1000, currency: 'usd', metadata: { orgId, product: 'blueprint' } }), { expectLivemode: false });
    assert.match(partial.detail, /Partial/);
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, true);
    await handleStripeEvent(store, ev('e3', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_r', refunded: true, amount_refunded: 39900, currency: 'usd', metadata: { orgId, product: 'blueprint' } }), { expectLivemode: false });
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, false);
    assert.equal((await sectionAccess(store, ctx, cfg, rec.rootId)).level, 'free');
    const history = await paymentHistory(store, ctx);
    assert.deepEqual(history.map((p) => p.status), ['refunded', 'partially_refunded', 'paid']);
  });

  test('a failed or abandoned checkout grants nothing and is recorded', async () => {
    const { store, orgId, ctx, rec } = await setup();
    await handleStripeEvent(store, ev('e1', 'checkout.session.async_payment_failed', { id: 'cs_f', metadata: { orgId, product: 'blueprint', assessmentRootId: rec.rootId } }), { expectLivemode: false });
    await handleStripeEvent(store, ev('e2', 'checkout.session.expired', { id: 'cs_x', metadata: { orgId, product: 'assessment', assessmentRootId: rec.rootId } }), { expectLivemode: false });
    assert.equal((await sectionAccess(store, ctx, cfg, rec.rootId)).level, 'free');
    assert.deepEqual((await paymentHistory(store, ctx)).map((p) => p.status), ['expired', 'failed']);
  });
});

describe('workspace subscription lifecycle', () => {
  const sub = (orgId: string, extra: Record<string, unknown> = {}) => ({ id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: T0 + 30 * 86400, metadata: { orgId, product: 'team' }, ...extra });

  test('active, then cancel at period end keeps access until the end, then deletion stops it', async () => {
    const { store, orgId, ctx, rec } = await setup();
    await handleStripeEvent(store, ev('s1', 'checkout.session.completed', { id: 'cs_t', payment_status: 'paid', subscription: 'sub_1', customer: 'cus_1', amount_total: 19900, currency: 'usd', metadata: { orgId, product: 'team' } }), { expectLivemode: false });
    await handleStripeEvent(store, ev('s2', 'customer.subscription.updated', sub(orgId)), { expectLivemode: false });
    const during = new Date((T0 + 86400) * 1000);
    assert.equal(subscriptionState(await readEntitlements(store, orgId), during), 'active');
    assert.equal(accessLevel(await readEntitlements(store, orgId), rec.rootId, during), 'blueprint');

    await handleStripeEvent(store, ev('s3', 'customer.subscription.updated', sub(orgId, { cancel_at_period_end: true })), { expectLivemode: false });
    assert.equal(subscriptionState(await readEntitlements(store, orgId), during), 'canceling');
    assert.equal(accessLevel(await readEntitlements(store, orgId), rec.rootId, during), 'blueprint', 'still paid for');

    await handleStripeEvent(store, ev('s4', 'customer.subscription.deleted', sub(orgId, { status: 'canceled', ended_at: T0 + 30 * 86400 }), T0 + 30 * 86400), { expectLivemode: false });
    const after = new Date((T0 + 31 * 86400) * 1000);
    assert.equal(subscriptionState(await readEntitlements(store, orgId), after), 'canceled');
    assert.equal(accessLevel(await readEntitlements(store, orgId), rec.rootId, after), 'free');
    assert.equal((await checkEntitlement(store, ctx, cfg, 'control-export', rec.rootId)).allowed, false);
  });

  test('immediate cancellation stops access now, not at the old period end', async () => {
    const { store, orgId, rec } = await setup();
    await handleStripeEvent(store, ev('s1', 'customer.subscription.updated', sub(orgId)), { expectLivemode: false });
    await handleStripeEvent(store, ev('s2', 'customer.subscription.deleted', sub(orgId, { status: 'canceled', ended_at: T0 + 86400 }), T0 + 86400), { expectLivemode: false });
    assert.equal(accessLevel(await readEntitlements(store, orgId), rec.rootId, new Date((T0 + 2 * 86400) * 1000)), 'free');
  });

  test('a subscription past its period with no renewal expires after the grace period', async () => {
    const { store, orgId, rec } = await setup();
    await handleStripeEvent(store, ev('s1', 'customer.subscription.updated', sub(orgId)), { expectLivemode: false });
    const end = (T0 + 30 * 86400) * 1000;
    const ent = await readEntitlements(store, orgId);
    assert.equal(subscriptionState(ent, new Date(end + RENEWAL_GRACE_MS - 1000)), 'active');
    assert.equal(subscriptionState(ent, new Date(end + RENEWAL_GRACE_MS + 1000)), 'expired');
    assert.equal(accessLevel(ent, rec.rootId, new Date(end + RENEWAL_GRACE_MS + 1000)), 'free');
  });

  test('failed invoice pauses, paid invoice restores and extends the period', async () => {
    const { store, orgId, ctx } = await setup();
    await handleStripeEvent(store, ev('s1', 'customer.subscription.updated', sub(orgId)), { expectLivemode: false });
    await handleStripeEvent(store, ev('i1', 'invoice.payment_failed', { id: 'in_1', amount_due: 19900, currency: 'usd', subscription_details: { metadata: { orgId } } }), { expectLivemode: false });
    assert.equal(subscriptionState(await readEntitlements(store, orgId), new Date(T0 * 1000)), 'past_due');
    const nextEnd = T0 + 60 * 86400;
    await handleStripeEvent(store, ev('i2', 'invoice.paid', { id: 'in_2', amount_paid: 19900, currency: 'usd', period_end: nextEnd, subscription_details: { metadata: { orgId } } }), { expectLivemode: false });
    const ent = await readEntitlements(store, orgId);
    assert.equal(subscriptionState(ent, new Date((T0 + 45 * 86400) * 1000)), 'active');
    assert.equal(ent.subscription!.currentPeriodEnd, new Date(nextEnd * 1000).toISOString());
    assert.deepEqual((await paymentHistory(store, ctx)).map((p) => `${p.kind}:${p.status}`), ['invoice:paid', 'invoice:failed']);
  });
});

describe('workspace records are org-isolated and role-checked', () => {
  test('profile and risk edits: other orgs cannot read or write them, viewers cannot edit', async () => {
    const a = await setup();
    const b = await setup();
    await saveOrgProfile(a.store, a.ctx, { industry: 'Logistics', regions: ['eu'], dataClasses: ['pii'] });
    assert.equal((await readOrgProfile(a.store, a.ctx))!.industry, 'Logistics');
    await assert.rejects(saveOrgProfile(a.store, a.ctx, { industry: 'x', evil: true }), /could not be saved/);
    await saveRiskEdit(a.store, a.ctx, a.rec.id, 'SEC-01', { status: 'mitigating' });
    assert.equal((await readRiskEdits(a.store, a.ctx, a.rec.id) as Record<string, { status: string }>)['SEC-01']!.status, 'mitigating');

    // Org B's member with org A's assessment id: not found, never data.
    const bInA = { ...b.ctx };
    await assert.rejects(readRiskEdits(a.store, { ...bInA, orgId: b.orgId }, a.rec.id), /not found/i);

    // A viewer in org A can read but not edit.
    const { token } = await createInvite(a.store, a.ctx, 'viewer@x.io', 'viewer');
    const v = await signup(a.store, { email: 'viewer@x.io', password: PW, name: 'V' });
    const vctx = await acceptInvite(a.store, v.id, token);
    await readRiskEdits(a.store, vctx, a.rec.id);
    await assert.rejects(saveRiskEdit(a.store, vctx, a.rec.id, 'SEC-01', { status: 'closed' }), /cannot/);
    await assert.rejects(renameOrg(a.store, vctx, 'Hijack'), /cannot/);
    await assert.rejects(saveRiskEdit(a.store, a.ctx, a.rec.id, '../../x', {}), /Unknown risk/);
  });
});
