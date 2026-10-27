import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore, MemoryStore, UpstashStore, resolveStore, type KvStore } from './store/index.js';

/** A tiny in-process Redis that speaks the Upstash REST protocol, for the adapter test. */
function fakeUpstash(): typeof fetch {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const lists = new Map<string, string[]>();
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const [cmd, key, ...args] = JSON.parse(String(init!.body)) as string[];
    let result: unknown = null;
    switch (cmd) {
      case 'GET': result = kv.get(key!) ?? null; break;
      case 'SET': {
        if (args.includes('NX') && kv.has(key!)) { result = null; break; }
        kv.set(key!, args[0]!); result = 'OK'; break;
      }
      case 'DEL': kv.delete(key!); sets.delete(key!); lists.delete(key!); result = 1; break;
      case 'INCR': { const n = Number(kv.get(key!) ?? 0) + 1; kv.set(key!, String(n)); result = n; break; }
      case 'SADD': { const s = sets.get(key!) ?? new Set(); s.add(args[0]!); sets.set(key!, s); result = 1; break; }
      case 'SREM': sets.get(key!)?.delete(args[0]!); result = 1; break;
      case 'SMEMBERS': result = Array.from(sets.get(key!) ?? []); break;
      case 'LPUSH': lists.set(key!, [args[0]!, ...(lists.get(key!) ?? [])]); result = 1; break;
      case 'LTRIM': lists.set(key!, (lists.get(key!) ?? []).slice(Number(args[0]), Number(args[1]) + 1)); result = 'OK'; break;
      case 'LRANGE': { const stop = Number(args[1]); result = (lists.get(key!) ?? []).slice(Number(args[0]), stop < 0 ? undefined : stop + 1); break; }
    }
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as typeof fetch;
}

const stores: [string, () => KvStore][] = [
  ['memory', () => new MemoryStore()],
  ['file', () => new FileStore(mkdtempSync(join(tmpdir(), 'aifit-store-')))],
  ['upstash', () => new UpstashStore('https://example.upstash.io', 'token', { fetchImpl: fakeUpstash() })],
];

for (const [name, make] of stores) {
  describe(`${name} store conforms to KvStore`, () => {
    test('get/set/del and NX', async () => {
      const s = make();
      assert.equal(await s.get('a'), null);
      assert.equal(await s.set('a', { x: 1 }), true);
      assert.deepEqual(await s.get('a'), { x: 1 });
      assert.equal(await s.set('a', { x: 2 }, { nx: true }), false);
      assert.deepEqual(await s.get('a'), { x: 1 });
      await s.del('a');
      assert.equal(await s.get('a'), null);
    });
    test('incr, sets and capped lists', async () => {
      const s = make();
      assert.equal(await s.incr('n'), 1);
      assert.equal(await s.incr('n'), 2);
      await s.sadd('set', 'b'); await s.sadd('set', 'a'); await s.sadd('set', 'a');
      assert.deepEqual(await s.smembers('set'), ['a', 'b']);
      await s.srem('set', 'a');
      assert.deepEqual(await s.smembers('set'), ['b']);
      for (let i = 0; i < 5; i++) await s.lpush('list', i, 3);
      assert.deepEqual(await s.lrange('list', 0, -1), [4, 3, 2]);
    });
    test('rejects keys outside the allowed alphabet', async () => {
      await assert.rejects(make().get('bad key with spaces'));
      await assert.rejects(make().set('../escape', 1));
    });
  });
}

test('memory store expires keys', async () => {
  let now = 0;
  const s = new MemoryStore(() => now);
  await s.set('k', 1, { ttlSeconds: 10 });
  now = 9_000;
  assert.equal(await s.get('k'), 1);
  now = 10_001;
  assert.equal(await s.get('k'), null);
});

test('on Vercel without Upstash there is no store, and the reason says why', () => {
  const r = resolveStore({ VERCEL: '1' });
  assert.equal(r.store, null);
  assert.match(r.reason, /UPSTASH_REDIS_REST_URL/);
  assert.equal(resolveStore({ VERCEL: '1', KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' }).store?.kind, 'upstash');
  assert.equal(resolveStore({ AIFIT_TEAMS_STORE: 'memory' }).store?.kind, 'memory');
});
