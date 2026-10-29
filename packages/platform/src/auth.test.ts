import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store/index.js';
import { authenticate, createSession, resolveSession, revokeSession, K } from './auth.js';
import { signup } from './account.js';
import { listUserOrgs } from './orgs.js';
import { sha256 } from './crypto.js';

const PW = 'correct horse battery staple';

describe('accounts and sessions', () => {
  test('sign-up creates a user and a personal workspace they own', async () => {
    const store = new MemoryStore();
    const u = await signup(store, { email: ' Ada@Example.com ', password: PW, name: 'Ada' });
    assert.equal(u.email, 'ada@example.com');
    const orgs = await listUserOrgs(store, u.id);
    assert.equal(orgs.length, 1);
    assert.equal(orgs[0]!.role, 'owner');
    assert.equal(orgs[0]!.id, u.personalOrgId);
  });

  test('passwords are hashed with scrypt, never stored in clear', async () => {
    const store = new MemoryStore();
    const u = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const stored = await store.get<{ passwordHash: string }>(K.user(u.id));
    assert.match(stored!.passwordHash, /^scrypt\$16384\$8\$1\$/);
    assert.ok(!JSON.stringify(stored).includes(PW));
  });

  test('duplicate email, short password and malformed email are refused', async () => {
    const store = new MemoryStore();
    await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    await assert.rejects(signup(store, { email: 'A@X.IO', password: PW, name: 'A2' }), { code: 'conflict' });
    await assert.rejects(signup(store, { email: 'b@x.io', password: 'short', name: 'B' }), { code: 'invalid' });
    await assert.rejects(signup(store, { email: 'not-an-email', password: PW, name: 'C' }), { code: 'invalid' });
  });

  test('login: wrong password and unknown email give the same answer', async () => {
    const store = new MemoryStore();
    await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const wrong = await authenticate(store, { email: 'a@x.io', password: 'nope nope nope' }).catch((e) => e);
    const unknown = await authenticate(store, { email: 'z@x.io', password: PW }).catch((e) => e);
    assert.equal(wrong.code, 'unauthenticated');
    assert.equal(unknown.message, wrong.message);
    assert.equal((await authenticate(store, { email: 'A@x.io', password: PW })).email, 'a@x.io');
  });

  test('sessions: only the token hash is stored; expiry and revocation work', async () => {
    const store = new MemoryStore();
    const u = await signup(store, { email: 'a@x.io', password: PW, name: 'A' });
    const { token } = await createSession(store, u.id, new Date('2026-10-27T00:00:00Z'));
    assert.equal(await store.get(`session:${token}`).catch(() => null), null);
    assert.ok(await store.get(K.session(sha256(token))));
    assert.equal((await resolveSession(store, token, new Date('2026-10-28T00:00:00Z')))?.user.id, u.id);
    assert.equal(await resolveSession(store, token, new Date('2026-11-11T00:00:01Z')), null, 'expired after 14 days');
    await revokeSession(store, token);
    assert.equal(await resolveSession(store, token, new Date('2026-10-28T00:00:00Z')), null);
    assert.equal(await resolveSession(store, 'x'.repeat(43)), null);
    assert.equal(await resolveSession(store, undefined), null);
  });
});
