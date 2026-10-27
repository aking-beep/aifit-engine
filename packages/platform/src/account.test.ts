import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store/index.js';
import { deleteAccount, exportAccount, signup } from './account.js';
import { acceptInvite, changeRole, contextFor, createInvite, listMembers } from './orgs.js';
import { createSession, findUserByEmail, resolveSession } from './auth.js';
import { listAssessments, saveAssessment } from './assessments.js';

const PW = 'correct horse battery staple';
const SNAP = { verdict: 'assisted', outcome: 'buy_ai', pattern: 'hybrid-human-loop', decisionInputHash: 'a'.repeat(64), engines: {} };

describe('account deletion and export', () => {
  test('deleting a solo account removes the user, their workspace, its data and sessions', async () => {
    const store = new MemoryStore();
    const u = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const ctx = await contextFor(store, u.id, u.personalOrgId);
    await saveAssessment(store, ctx, { title: 't', workload: { secret: 1 }, snapshot: SNAP });
    const { token } = await createSession(store, u.id);
    const out = await deleteAccount(store, u.id);
    assert.deepEqual(out.deletedWorkspaces, [u.personalOrgId]);
    assert.equal(await findUserByEmail(store, 'a@x.io'), null);
    assert.equal(await resolveSession(store, token), null);
    await assert.rejects(contextFor(store, u.id, u.personalOrgId), { code: 'not_found' });
    assert.equal(await store.get(`org:${u.personalOrgId}:assessment:${(await store.smembers(`org:${u.personalOrgId}:assessments`))[0] ?? 'none'}`), null);
    const again = await signup(store, { email: 'a@x.io', password: PW, name: 'A again' });
    assert.notEqual(again.id, u.id, 'the email can be used again');
  });

  test('the only owner of a shared workspace must hand it over first; then they leave and the team keeps its data', async () => {
    const store = new MemoryStore();
    const owner = await signup(store, { email: 'o@x.io', password: PW, name: 'O' });
    const bob = await signup(store, { email: 'b@x.io', password: PW, name: 'B' });
    const ownerCtx = await contextFor(store, owner.id, owner.personalOrgId);
    await acceptInvite(store, bob.id, (await createInvite(store, ownerCtx, 'b@x.io', 'member')).token);
    await saveAssessment(store, ownerCtx, { title: 'team work', workload: {}, snapshot: SNAP });
    await assert.rejects(deleteAccount(store, owner.id), { code: 'conflict' });
    await changeRole(store, ownerCtx, bob.id, 'owner');
    const out = await deleteAccount(store, owner.id);
    assert.deepEqual(out.leftWorkspaces, [owner.personalOrgId]);
    const bobCtx = await contextFor(store, bob.id, owner.personalOrgId);
    assert.equal((await listAssessments(store, bobCtx)).length, 1);
    assert.deepEqual((await listMembers(store, bobCtx)).map((m) => m.email), ['b@x.io']);
  });

  test('export contains the account and its workspaces but never the password hash', async () => {
    const store = new MemoryStore();
    const u = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const out = await exportAccount(store, u.id);
    assert.equal(out.user.email, 'a@x.io');
    assert.equal(out.workspaces.length, 1);
    assert.ok(!JSON.stringify(out).includes('scrypt$'));
  });
});
