import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store/index.js';
import { signup } from './account.js';
import { ROLES, acceptInvite, can, changeRole, contextFor, createInvite, listMembers, readAudit, removeMember, type Action } from './orgs.js';
import { saveAssessment } from './assessments.js';

const PW = 'correct horse battery staple';
const SNAP = { verdict: 'assisted', outcome: 'buy_ai', pattern: 'hybrid-human-loop', decisionInputHash: 'a'.repeat(64), engines: { decision: '1.0.0' } };

describe('role permissions', () => {
  const matrix: [Action, string[]][] = [
    ['assessment:read', ['viewer', 'member', 'admin', 'owner']],
    ['assessment:write', ['member', 'admin', 'owner']],
    ['export:download', ['member', 'admin', 'owner']],
    ['assessment:delete', ['admin', 'owner']],
    ['members:manage', ['admin', 'owner']],
    ['billing:manage', ['admin', 'owner']],
    ['org:delete', ['owner']],
  ];
  for (const [action, allowed] of matrix) {
    test(action, () => {
      for (const role of ROLES) assert.equal(can(role, action), allowed.includes(role), `${role} ${action}`);
    });
  }
});

async function team() {
  const store = new MemoryStore();
  const owner = await signup(store, { email: 'owner@x.io', password: PW, name: 'Owner' });
  const bob = await signup(store, { email: 'bob@x.io', password: PW, name: 'Bob' });
  const eve = await signup(store, { email: 'eve@x.io', password: PW, name: 'Eve' });
  const ownerCtx = await contextFor(store, owner.id, owner.personalOrgId);
  return { store, owner, bob, eve, ownerCtx };
}

describe('invites and membership', () => {
  test('an invite is bound to its email address', async () => {
    const { store, bob, eve, ownerCtx } = await team();
    const { token } = await createInvite(store, ownerCtx, 'bob@x.io', 'viewer');
    await assert.rejects(acceptInvite(store, eve.id, token), { code: 'forbidden' });
    const ctx = await acceptInvite(store, bob.id, token);
    assert.equal(ctx.role, 'viewer');
    await assert.rejects(acceptInvite(store, bob.id, token), { code: 'not_found' }, 'one-time token');
    assert.equal((await listMembers(store, ownerCtx)).length, 2);
  });

  test('a viewer can read but not write, and cannot invite', async () => {
    const { store, bob, ownerCtx } = await team();
    const { token } = await createInvite(store, ownerCtx, 'bob@x.io', 'viewer');
    const viewer = await acceptInvite(store, bob.id, token);
    await assert.rejects(saveAssessment(store, viewer, { title: 't', workload: {}, snapshot: SNAP }), { code: 'forbidden' });
    await assert.rejects(createInvite(store, viewer, 'x@x.io', 'member'), { code: 'forbidden' });
  });

  test('the last owner cannot be demoted or removed', async () => {
    const { store, owner, ownerCtx } = await team();
    await assert.rejects(changeRole(store, ownerCtx, owner.id, 'admin'), { code: 'conflict' });
    await assert.rejects(removeMember(store, ownerCtx, owner.id), { code: 'conflict' });
  });

  test('an admin cannot promote anyone to owner', async () => {
    const { store, bob, eve, ownerCtx } = await team();
    const admin = await acceptInvite(store, bob.id, (await createInvite(store, ownerCtx, 'bob@x.io', 'admin')).token);
    await acceptInvite(store, eve.id, (await createInvite(store, ownerCtx, 'eve@x.io', 'member')).token);
    await assert.rejects(changeRole(store, admin, eve.id, 'owner'), { code: 'forbidden' });
    await changeRole(store, admin, eve.id, 'viewer');
  });

  test('membership changes are audited', async () => {
    const { store, bob, ownerCtx } = await team();
    await acceptInvite(store, bob.id, (await createInvite(store, ownerCtx, 'bob@x.io', 'member')).token);
    const events = (await readAudit(store, ownerCtx)).map((e) => e.event);
    assert.ok(events.includes('member.invited') && events.includes('member.joined') && events.includes('org.created'));
  });
});
