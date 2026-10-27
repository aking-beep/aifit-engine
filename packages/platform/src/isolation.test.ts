import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store/index.js';
import { signup } from './account.js';
import { contextFor, listMembers } from './orgs.js';
import { getAssessment, listAssessments, reassess, saveAssessment, deleteAssessment, versions } from './assessments.js';
import { checkEntitlement } from './entitlements.js';
import { billingConfig } from './billing/config.js';

const PW = 'correct horse battery staple';
const SNAP = { verdict: 'assisted', outcome: 'buy_ai', pattern: 'hybrid-human-loop', decisionInputHash: 'a'.repeat(64), engines: { decision: '1.0.0' } };

/**
 * Cross-organisation isolation. Two companies on one deployment must never see
 * each other's assessments, members or entitlements, whatever ids they guess.
 */
describe('cross-organisation isolation', () => {
  async function twoOrgs() {
    const store = new MemoryStore();
    const a = await signup(store, { email: 'a@acme.io', password: PW, name: 'A', orgName: 'Acme' });
    const b = await signup(store, { email: 'b@globex.io', password: PW, name: 'B', orgName: 'Globex' });
    const ctxA = await contextFor(store, a.id, a.personalOrgId);
    const ctxB = await contextFor(store, b.id, b.personalOrgId);
    const recA = await saveAssessment(store, ctxA, { title: 'Acme secret plan', workload: { secret: 'acme' }, snapshot: SNAP });
    const recB = await saveAssessment(store, ctxB, { title: 'Globex secret plan', workload: { secret: 'globex' }, snapshot: SNAP });
    return { store, a, b, ctxA, ctxB, recA, recB };
  }

  test('a user cannot obtain a context for an org they do not belong to', async () => {
    const { store, a, b } = await twoOrgs();
    await assert.rejects(contextFor(store, a.id, b.personalOrgId), { code: 'not_found' });
    await assert.rejects(contextFor(store, b.id, a.personalOrgId), { code: 'not_found' });
  });

  test('another org\'s assessment id reads as not found, not forbidden', async () => {
    const { store, ctxA, recB } = await twoOrgs();
    await assert.rejects(getAssessment(store, ctxA, recB.id), { code: 'not_found' });
    await assert.rejects(reassess(store, ctxA, recB.id, { title: 'x', workload: {}, snapshot: SNAP }), { code: 'not_found' });
    assert.deepEqual(await versions(store, ctxA, recB.rootId), [], 'version lookups are scoped to the caller\'s org');
  });

  test('lists only ever contain the caller\'s own org', async () => {
    const { store, ctxA, ctxB, recA, recB } = await twoOrgs();
    assert.deepEqual((await listAssessments(store, ctxA)).map((r) => r.id), [recA.id]);
    assert.deepEqual((await listAssessments(store, ctxB)).map((r) => r.id), [recB.id]);
    assert.deepEqual((await listMembers(store, ctxA)).map((m) => m.email), ['a@acme.io']);
  });

  test('deleting in one org cannot touch the other', async () => {
    const { store, ctxA, ctxB, recB } = await twoOrgs();
    await assert.rejects(deleteAssessment(store, ctxA, recB.id), { code: 'not_found' });
    assert.equal((await getAssessment(store, ctxB, recB.id)).title, 'Globex secret plan');
  });

  test('ids that do not look like assessment ids are refused before any lookup', async () => {
    const { store, ctxA } = await twoOrgs();
    for (const id of ['../org:x', 'asm_*', '', 'asm_' + 'a'.repeat(40)]) {
      await assert.rejects(getAssessment(store, ctxA, id), { code: 'not_found' });
    }
  });

  test('a purchase in one org does not unlock the other', async () => {
    const { store, ctxA, ctxB, recA } = await twoOrgs();
    const cfg = billingConfig({ BILLING_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_BLUEPRINT: 'price_1' });
    await store.set(`org:${ctxA.orgId}:entitlements`, { plan: 'free', subscription: null, purchases: [{ product: 'blueprint', assessmentRootId: recA.rootId, checkoutSessionId: 'cs_1', at: '' }] });
    assert.equal((await checkEntitlement(store, ctxA, cfg, 'blueprint', recA.rootId)).allowed, true);
    assert.equal((await checkEntitlement(store, ctxB, cfg, 'blueprint', recA.rootId)).allowed, false);
  });
});

describe('versioned assessments', () => {
  test('reassessment adds a version on the same root and keeps the earlier one intact', async () => {
    const store = new MemoryStore();
    const a = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const ctx = await contextFor(store, a.id, a.personalOrgId);
    const v1 = await saveAssessment(store, ctx, { title: 'Triage', workload: { volume: 100 }, snapshot: SNAP });
    const v2 = await reassess(store, ctx, v1.id, { title: 'Triage', workload: { volume: 4000 }, snapshot: { ...SNAP, outcome: 'build_ai' } });
    const v3 = await reassess(store, ctx, v2.id, { title: 'Triage', workload: { volume: 5000 }, snapshot: SNAP });
    assert.deepEqual([v1.version, v2.version, v3.version], [1, 2, 3]);
    assert.equal(v3.rootId, v1.id);
    assert.equal(v3.parentId, v2.id);
    assert.deepEqual((await getAssessment(store, ctx, v1.id)).workload, { volume: 100 });
    const list = await listAssessments(store, ctx);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, v3.id);
    assert.equal(list[0]!.versions, 3);
    await deleteAssessment(store, ctx, v2.id);
    assert.equal((await listAssessments(store, ctx)).length, 0, 'deleting removes every version');
  });

  test('a malformed snapshot is refused', async () => {
    const store = new MemoryStore();
    const a = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const ctx = await contextFor(store, a.id, a.personalOrgId);
    await assert.rejects(saveAssessment(store, ctx, { title: '', workload: {}, snapshot: SNAP }), { code: 'invalid' });
    await assert.rejects(saveAssessment(store, ctx, { title: 't', workload: {}, snapshot: { ...SNAP, decisionInputHash: 'nope' } }), { code: 'invalid' });
  });
});
