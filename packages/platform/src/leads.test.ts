import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MemoryStore } from './store/memory.js';
import { authorizeLeadExport, forwardLead, leadsCsv, listLeads, parseLead, saveLead, signLeadPayload } from './leads.js';
import { PlatformError } from './errors.js';

const valid = {
  email: ' Pat@Example.com ',
  name: 'Pat',
  interest: 'assessment',
  consent: true,
  source: {
    app: 'ai-fit-teams',
    page: 'for/operations',
    attribution: { utm: { utm_source: 'linkedin', utm_campaign: 'q4-ops' }, clickIds: {}, landingPath: '/for/operations', referrerHost: null, firstSeenAt: '2026-10-29T00:00:00.000Z' },
  },
};

test('a valid lead is normalised, stored and listed newest first', async () => {
  const store = new MemoryStore();
  const { lead, spam } = parseLead(valid);
  assert.equal(spam, false);
  assert.equal(lead.email, 'pat@example.com');
  const a = await saveLead(store, lead, null);
  const b = await saveLead(store, parseLead({ ...valid, email: 'b@example.com' }).lead, 'usr_1');
  const rows = await listLeads(store);
  assert.deepEqual(rows.map((r) => r.id), [b.id, a.id]);
  assert.equal(rows[0]!.userId, 'usr_1');
  assert.ok(!('website' in rows[0]!) && !('consent' in rows[0]!));
});

test('consent, email and unknown fields are enforced', () => {
  assert.throws(() => parseLead({ ...valid, consent: false }), /Tick the box/);
  assert.throws(() => parseLead({ ...valid, email: 'nope' }), /valid email/);
  assert.throws(() => parseLead({ ...valid, admin: true }), PlatformError);
  assert.throws(() => parseLead({ ...valid, source: { ...valid.source, page: '<script>' } }), PlatformError);
  assert.throws(() => parseLead({ ...valid, message: 'x'.repeat(1001) }), PlatformError);
});

test('the honeypot marks spam', () => {
  assert.equal(parseLead({ ...valid, website: 'http://spam.example' }).spam, true);
});

test('export needs a long bearer token', () => {
  assert.throws(() => authorizeLeadExport('Bearer x', undefined), /off/);
  const t = 'a'.repeat(32);
  assert.throws(() => authorizeLeadExport('Bearer wrong', t), /Wrong/);
  assert.doesNotThrow(() => authorizeLeadExport(`Bearer ${t}`, t));
});

test('CSV escapes quotes and neutralises spreadsheet formulas', async () => {
  const store = new MemoryStore();
  await saveLead(store, parseLead({ ...valid, name: '=HYPERLINK("x")', message: 'a, "b"' }).lead, null);
  const csv = leadsCsv(await listLeads(store));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"a, ""b"""/);
  assert.match(csv, /linkedin/);
});

test('forwarding signs the body, refuses http, and never throws', async () => {
  const store = new MemoryStore();
  const lead = await saveLead(store, parseLead(valid).lead, null);
  let seen: { url: string; sig: string; body: string } | null = null;
  const ok = await forwardLead({ url: 'https://hooks.example/lead', secret: 's3cret' }, lead, (async (url: URL, init: RequestInit) => {
    seen = { url: String(url), sig: (init.headers as Record<string, string>)['x-aifit-signature']!, body: String(init.body) };
    return new Response('ok');
  }) as typeof fetch);
  assert.equal(ok, true);
  const { sig, body } = seen!;
  const [t, v1] = sig.split(',').map((p) => p.split('=')[1]);
  assert.equal(v1, createHmac('sha256', 's3cret').update(`${t}.${body}`).digest('hex'));
  assert.equal(signLeadPayload(body, 's3cret', Number(t)), sig);
  assert.equal(await forwardLead({ url: 'http://insecure.example' }, lead), false);
  assert.equal(await forwardLead({ url: 'https://down.example' }, lead, (async () => { throw new Error('down'); }) as typeof fetch), false);
  assert.equal(await forwardLead({}, lead), false);
});
