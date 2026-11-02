import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailConfig, sendEmail, templates } from './email.js';

test('email is off without a key or a valid from address', () => {
  assert.equal(emailConfig({}).enabled, false);
  assert.equal(emailConfig({ RESEND_API_KEY: 're_x' }).enabled, false);
  assert.equal(emailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'not an address' }).enabled, false);
  assert.equal(emailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'AI Fit <hello@example.com>' }).enabled, true);
});

test('sendEmail posts plain text with an idempotency key and never throws', async () => {
  const cfg = emailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'hello@example.com', APP_URL: 'https://app.example' });
  let sent: { headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  const ok = await sendEmail(cfg, { to: 'a@example.com', idempotencyKey: 'evt_1', ...templates.passwordReset('AI Fit Teams', 'https://app.example/reset?token=t', 30) }, (async (_u: string, init: RequestInit) => {
    sent = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
    return new Response('{}');
  }) as typeof fetch);
  assert.equal(ok, true);
  assert.equal(sent!.headers['idempotency-key'], 'evt_1');
  assert.equal((sent!.body.to as string[])[0], 'a@example.com');
  assert.ok(!('html' in sent!.body));
  assert.match(String(sent!.body.text), /30 minutes/);
  assert.equal(await sendEmail(cfg, { to: 'bad', subject: 's', text: 't' }), false);
  assert.equal(await sendEmail(emailConfig({}), { to: 'a@example.com', subject: 's', text: 't' }), false);
  assert.equal(await sendEmail(cfg, { to: 'a@example.com', subject: 's', text: 't' }, (async () => { throw new Error('down'); }) as typeof fetch), false);
});
