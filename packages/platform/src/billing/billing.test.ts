import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../store/index.js';
import { signup } from '../account.js';
import { contextFor } from '../orgs.js';
import { billingConfig } from './config.js';
import { createCheckoutSession } from './stripe.js';
import { handleStripeEvent, signStripePayload, verifyStripeSignature, WK, type StripeEvent } from './webhook.js';
import { checkEntitlement, readEntitlements, requireEntitlement } from '../entitlements.js';
import { saveAssessment } from '../assessments.js';

const SECRET = 'whsec_test_secret_abcdefghijklmnop';
const TEST_ENV = { BILLING_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_BLUEPRINT: 'price_bp', STRIPE_PRICE_TEAM_MONTHLY: 'price_team', APP_URL: 'https://teams.example' };
const PW = 'correct horse battery staple';
const SNAP = { verdict: 'assisted', outcome: 'buy_ai', pattern: 'hybrid-human-loop', decisionInputHash: 'a'.repeat(64), engines: {} };

describe('billing mode never turns on by accident', () => {
  test('off by default, and everything is free', () => {
    const c = billingConfig({});
    assert.equal(c.mode, 'off');
    assert.equal(c.enabled, false);
  });
  test('test mode refuses a live key', () => {
    const c = billingConfig({ ...TEST_ENV, STRIPE_SECRET_KEY: 'sk_live_abc' });
    assert.equal(c.enabled, false);
    assert.match(c.reason, /live key was refused/);
  });
  test('live mode needs a live key and a second explicit switch', () => {
    assert.equal(billingConfig({ ...TEST_ENV, BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_abc' }).enabled, false);
    assert.equal(billingConfig({ ...TEST_ENV, BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_test_abc', BILLING_ALLOW_LIVE: '1' }).enabled, false);
    assert.equal(billingConfig({ ...TEST_ENV, BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_abc', BILLING_ALLOW_LIVE: '1' }).mode, 'live');
  });
  test('no webhook secret means no billing, because payments could not be fulfilled', () => {
    assert.equal(billingConfig({ ...TEST_ENV, STRIPE_WEBHOOK_SECRET: '' }).enabled, false);
  });
  test('test mode with everything set is enabled', () => {
    const c = billingConfig(TEST_ENV);
    assert.equal(c.mode, 'test');
    assert.equal(c.enabled, true);
  });
});

describe('hosted checkout', () => {
  test('creates a session with org metadata and an idempotency key, and grants nothing', async () => {
    const store = new MemoryStore();
    const u = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    let captured: { headers: Record<string, string>; body: URLSearchParams } | null = null;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      captured = { headers: init!.headers as Record<string, string>, body: new URLSearchParams(String(init!.body)) };
      return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
    }) as typeof fetch;
    const out = await createCheckoutSession(billingConfig(TEST_ENV), { product: 'blueprint', orgId: u.personalOrgId, userId: u.id, email: u.email, assessmentRootId: 'asm_1', idempotencyKey: 'k1' }, fetchImpl);
    assert.equal(out.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
    assert.equal(captured!.headers['idempotency-key'], 'k1');
    assert.equal(captured!.body.get('mode'), 'payment');
    assert.equal(captured!.body.get('metadata[orgId]'), u.personalOrgId);
    assert.equal(captured!.body.get('metadata[assessmentRootId]'), 'asm_1');
    assert.equal(captured!.body.get('success_url'), 'https://teams.example/billing?status=success&session_id={CHECKOUT_SESSION_ID}');
    assert.equal((await readEntitlements(store, u.personalOrgId)).purchases.length, 0);
  });

  test('refuses when billing is off', async () => {
    await assert.rejects(createCheckoutSession(billingConfig({}), { product: 'team', orgId: 'o', userId: 'u', email: 'e@x.io', idempotencyKey: 'k' }), { code: 'unavailable' });
  });
});

describe('webhook signature verification', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', created: 1, livemode: false, data: { object: {} } });
  const now = 1_793_000_000_000;
  const t = Math.floor(now / 1000);

  test('accepts a correct signature', () => {
    assert.equal(verifyStripeSignature(body, signStripePayload(body, SECRET, t), SECRET, { now }).id, 'evt_1');
  });
  test('accepts when any of several v1 signatures matches (secret rotation)', () => {
    const good = signStripePayload(body, SECRET, t).split(',')[1];
    assert.equal(verifyStripeSignature(body, `t=${t},v1=${'0'.repeat(64)},${good}`, SECRET, { now }).id, 'evt_1');
  });
  const bad: [string, () => unknown][] = [
    ['a missing header', () => verifyStripeSignature(body, null, SECRET, { now })],
    ['a tampered body', () => verifyStripeSignature(body.replace('evt_1', 'evt_2'), signStripePayload(body, SECRET, t), SECRET, { now })],
    ['the wrong secret', () => verifyStripeSignature(body, signStripePayload(body, 'whsec_other', t), SECRET, { now })],
    ['an old timestamp (replay)', () => verifyStripeSignature(body, signStripePayload(body, SECRET, t - 301), SECRET, { now })],
    ['a malformed header', () => verifyStripeSignature(body, 'v1=abc', SECRET, { now })],
    ['a body that is not an event', () => verifyStripeSignature('{"hello":1}', signStripePayload('{"hello":1}', SECRET, t), SECRET, { now })],
  ];
  for (const [name, fn] of bad) test(`rejects ${name}`, () => assert.throws(fn, { code: 'invalid' }));
});

async function paidOrg() {
  const store = new MemoryStore();
  const u = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
  const ctx = await contextFor(store, u.id, u.personalOrgId);
  const rec = await saveAssessment(store, ctx, { title: 't', workload: {}, snapshot: SNAP });
  return { store, u, ctx, rec };
}

function event(id: string, type: string, object: Record<string, unknown>, livemode = false): StripeEvent {
  return { id, type, created: 1_793_000_000, livemode, data: { object } };
}

describe('webhook fulfilment', () => {
  test('a paid blueprint checkout grants exactly that assessment, once, however often it is delivered', async () => {
    const { store, ctx, rec } = await paidOrg();
    const cfg = billingConfig(TEST_ENV);
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, false);
    const e = event('evt_paid', 'checkout.session.completed', { id: 'cs_1', payment_status: 'paid', metadata: { orgId: ctx.orgId, product: 'blueprint', assessmentRootId: rec.rootId } });
    assert.equal((await handleStripeEvent(store, e, { expectLivemode: false })).status, 'processed');
    for (let i = 0; i < 3; i++) assert.equal((await handleStripeEvent(store, e, { expectLivemode: false })).status, 'duplicate');
    const ent = await readEntitlements(store, ctx.orgId);
    assert.equal(ent.purchases.length, 1);
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, true);
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', 'asm_other')).allowed, false);
    assert.deepEqual(await store.get(WK.checkout('cs_1')), { status: 'paid', orgId: ctx.orgId });
  });

  test('two concurrent deliveries apply the event once', async () => {
    const { store, ctx, rec } = await paidOrg();
    const e = event('evt_race', 'checkout.session.completed', { id: 'cs_2', payment_status: 'paid', metadata: { orgId: ctx.orgId, product: 'blueprint', assessmentRootId: rec.rootId } });
    const results = await Promise.all([handleStripeEvent(store, e, { expectLivemode: false }), handleStripeEvent(store, e, { expectLivemode: false })]);
    const statuses = results.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 'processed').length, 1, `exactly one delivery applies it: ${statuses}`);
    assert.ok(statuses.every((s) => s === 'processed' || s === 'in_progress' || s === 'duplicate'));
    assert.equal((await readEntitlements(store, ctx.orgId)).purchases.length, 1);
  });

  test('an unpaid (delayed) checkout grants nothing until payment succeeds', async () => {
    const { store, ctx, rec } = await paidOrg();
    const cfg = billingConfig(TEST_ENV);
    const meta = { orgId: ctx.orgId, product: 'blueprint', assessmentRootId: rec.rootId };
    await handleStripeEvent(store, event('evt_a', 'checkout.session.completed', { id: 'cs_3', payment_status: 'unpaid', metadata: meta }), { expectLivemode: false });
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, false);
    await handleStripeEvent(store, event('evt_b', 'checkout.session.async_payment_succeeded', { id: 'cs_3', payment_status: 'paid', metadata: meta }), { expectLivemode: false });
    assert.equal((await checkEntitlement(store, ctx, cfg, 'blueprint', rec.rootId)).allowed, true);
  });

  test('failed and expired checkouts are recorded and grant nothing', async () => {
    const { store, ctx, rec } = await paidOrg();
    const meta = { orgId: ctx.orgId, product: 'blueprint', assessmentRootId: rec.rootId };
    await handleStripeEvent(store, event('evt_f', 'checkout.session.async_payment_failed', { id: 'cs_4', metadata: meta }), { expectLivemode: false });
    await handleStripeEvent(store, event('evt_x', 'checkout.session.expired', { id: 'cs_5', metadata: meta }), { expectLivemode: false });
    assert.deepEqual(await store.get(WK.checkout('cs_4')), { status: 'failed', orgId: ctx.orgId });
    assert.deepEqual(await store.get(WK.checkout('cs_5')), { status: 'expired', orgId: ctx.orgId });
    assert.equal((await readEntitlements(store, ctx.orgId)).purchases.length, 0);
  });

  test('subscription lifecycle: active, payment failed, cancelled', async () => {
    const { store, ctx, rec } = await paidOrg();
    const cfg = billingConfig(TEST_ENV);
    await handleStripeEvent(store, event('evt_s1', 'checkout.session.completed', { id: 'cs_6', mode: 'subscription', payment_status: 'paid', subscription: 'sub_1', customer: 'cus_1', metadata: { orgId: ctx.orgId, product: 'team' } }), { expectLivemode: false });
    assert.equal((await checkEntitlement(store, ctx, cfg, 'control-export', rec.rootId)).allowed, true);
    await handleStripeEvent(store, event('evt_s2', 'invoice.payment_failed', { subscription_details: { metadata: { orgId: ctx.orgId } } }), { expectLivemode: false });
    const failed = await checkEntitlement(store, ctx, cfg, 'control-export', rec.rootId);
    assert.equal(failed.allowed, false);
    assert.match(failed.reason, /payment failed/i);
    await handleStripeEvent(store, event('evt_s3', 'customer.subscription.updated', { id: 'sub_1', status: 'active', current_period_end: 1_795_000_000, metadata: { orgId: ctx.orgId } }), { expectLivemode: false });
    assert.equal((await checkEntitlement(store, ctx, cfg, 'control-export', rec.rootId)).allowed, true);
    await handleStripeEvent(store, event('evt_s4', 'customer.subscription.deleted', { id: 'sub_1', status: 'canceled', metadata: { orgId: ctx.orgId } }), { expectLivemode: false });
    assert.equal((await checkEntitlement(store, ctx, cfg, 'control-export', rec.rootId)).allowed, false);
  });

  test('a live-mode event on a test deployment is ignored', async () => {
    const { store, ctx, rec } = await paidOrg();
    const r = await handleStripeEvent(store, event('evt_live', 'checkout.session.completed', { id: 'cs_7', payment_status: 'paid', metadata: { orgId: ctx.orgId, product: 'blueprint', assessmentRootId: rec.rootId } }, true), { expectLivemode: false });
    assert.equal(r.status, 'ignored');
    assert.equal((await readEntitlements(store, ctx.orgId)).purchases.length, 0);
  });

  test('an event for an unknown workspace is ignored', async () => {
    const { store } = await paidOrg();
    const r = await handleStripeEvent(store, event('evt_u', 'checkout.session.completed', { id: 'cs_8', payment_status: 'paid', metadata: { orgId: 'org_doesnotexist', product: 'team' } }), { expectLivemode: false });
    assert.equal(r.status, 'ignored');
  });

  test('if applying fails, the event is not marked processed, so a retry can apply it', async () => {
    const { store, ctx, rec } = await paidOrg();
    const e = event('evt_retry', 'checkout.session.completed', { id: 'cs_9', payment_status: 'paid', metadata: { orgId: ctx.orgId, product: 'blueprint', assessmentRootId: rec.rootId } });
    const originalSet = store.set.bind(store);
    let fail = true;
    store.set = (async (key: string, value: unknown, opts?: { ttlSeconds?: number; nx?: boolean }) => {
      if (fail && key.endsWith(':entitlements')) throw new Error('store down');
      return originalSet(key, value, opts);
    }) as typeof store.set;
    await assert.rejects(handleStripeEvent(store, e, { expectLivemode: false }));
    fail = false;
    assert.equal((await handleStripeEvent(store, e, { expectLivemode: false })).status, 'processed');
    assert.equal((await readEntitlements(store, ctx.orgId)).purchases.length, 1);
  });
});

describe('entitlement checks', () => {
  test('billing off: allowed, and says so', async () => {
    const { store, ctx, rec } = await paidOrg();
    const d = await checkEntitlement(store, ctx, billingConfig({}), 'blueprint', rec.rootId);
    assert.deepEqual(d, { allowed: true, reason: 'Billing is off on this deployment.' });
  });
  test('billing on: payment required until a verified webhook grants it', async () => {
    const { store, ctx, rec } = await paidOrg();
    await assert.rejects(requireEntitlement(store, ctx, billingConfig(TEST_ENV), 'blueprint', rec.rootId), { code: 'payment_required' });
  });
  test('viewers cannot download even when entitled', async () => {
    const { store, ctx, rec } = await paidOrg();
    await assert.rejects(checkEntitlement(store, { ...ctx, role: 'viewer' }, billingConfig({}), 'blueprint', rec.rootId), { code: 'forbidden' });
  });
});
