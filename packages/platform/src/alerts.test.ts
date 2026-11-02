import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store/index.js';
import { alertConfig, raiseAlert, scrubDetail } from './alerts.js';

const capture = () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init!.body)) });
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
};

describe('operator alerts', () => {
  test('off unless an HTTPS webhook or an email is configured', async () => {
    assert.equal(alertConfig({}).enabled, false);
    assert.equal(alertConfig({ ALERT_WEBHOOK_URL: 'http://hooks.example/x' }).enabled, false);
    assert.equal(alertConfig({ ALERT_EMAIL: 'not-an-email' }).enabled, false);
    assert.equal(alertConfig({ ALERT_WEBHOOK_URL: 'https://hooks.example/x' }).enabled, true);
    const { calls, fetchImpl } = capture();
    assert.equal(await raiseAlert(alertConfig({}), null, { app: 'ai-fit-teams', kind: 'server_error', detail: 'x' }, { fetchImpl }), false);
    assert.equal(calls.length, 0);
  });

  test('posts Slack- and Discord-readable JSON, once per kind per window', async () => {
    const cfg = alertConfig({ ALERT_WEBHOOK_URL: 'https://hooks.example/x', VERCEL_ENV: 'production' });
    const store = new MemoryStore();
    const { calls, fetchImpl } = capture();
    const alert = { app: 'ai-fit-teams' as const, kind: 'webhook_failed' as const, detail: 'POST /api/billing/webhook: 503 Billing is not enabled' };
    assert.equal(await raiseAlert(cfg, store, alert, { fetchImpl }), true);
    assert.equal(await raiseAlert(cfg, store, alert, { fetchImpl }), false, 'throttled');
    assert.equal(await raiseAlert(cfg, store, { ...alert, kind: 'checkout_failed' }, { fetchImpl }), true, 'another kind is not throttled');
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.body.kind, 'webhook_failed');
    assert.match(String(calls[0]!.body.text), /\[ai-fit-teams production\] webhook failed/);
    assert.equal(calls[0]!.body.text, calls[0]!.body.content);
  });

  test('never sends customer emails or keys, and never throws', async () => {
    assert.equal(
      scrubDetail('pat@example.com sk_live_abc123 whsec_xyz Bearer abc.def sk-ant-api03-zzz'),
      '[email] [key] [key] Bearer [key] [key]',
    );
    const cfg = alertConfig({ ALERT_WEBHOOK_URL: 'https://hooks.example/x' });
    const broken = (async () => { throw new Error('network down'); }) as typeof fetch;
    assert.equal(await raiseAlert(cfg, new MemoryStore(), { app: 'ai-fit', kind: 'server_error', detail: 'x' }, { fetchImpl: broken }), false);
  });
});
