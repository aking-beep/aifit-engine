import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SUPPORT_TRIAGE, Workload, urlCodec } from '@aifit/teams-core';
import { TRIAGE_LINK } from './helpers';

// Runs against the :3013 server: agents on, Anthropic SDK pointed at a local
// stub with fixed replies (e2e/stub-anthropic.mjs). This checks the wiring —
// SDK request shape, structured-output parsing, the evidence check, the human
// gate, server-side recomputation — not the quality of any model.

const STUB = 'http://127.0.0.1:3019/__requests';
const encoded = urlCodec(Workload).encode(SUPPORT_TRIAGE);

test('intake suggestions are checked, shown with evidence, and applied only on click', async ({ page, request }) => {
  await page.goto(`/assess?w=${encoded}`);
  await page.getByRole('button', { name: 'Suggest answers from this description' }).click();
  const list = page.getByRole('list', { name: 'Suggested answers' });
  await expect(list).toBeVisible();
  // The stub also suggests "phi" quoting text that is not in the description; the check drops it.
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText(/Data classes/)).toHaveCount(0);
  await expect(page.getByText('Who reviews the routing today?')).toBeVisible();

  const summarize = page.getByRole('button', { name: /^Summari[sz]e/ });
  const wasPressed = await summarize.getAttribute('aria-pressed');
  await page.getByRole('button', { name: /^Apply Shape of the work/ }).click();
  await expect(page.getByRole('button', { name: /^Applied Shape of the work/ })).toBeDisabled();
  if (wasPressed !== null) await expect(summarize).toHaveAttribute('aria-pressed', 'true');

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  const sent = (await (await request.get(STUB)).json()) as { beta: string | null; body: any }[];
  const call = sent.find((r) => String(r.body.messages?.[0]?.content).includes('<description>'))!;
  expect(call.beta).toContain('server-side-fallback-2026-07-01');
  expect(call.body.output_config.format.type).toBe('json_schema');
  expect(call.body.model).toBe('claude-opus-5-5');
});

test('the report explains its decision without sending the description, and the client cannot pick the outcome', async ({ page, request }) => {
  await page.goto(TRIAGE_LINK);
  const box = page.getByTestId('explain-decision');
  await box.getByRole('button', { name: 'Explain this in plain language' }).click();
  await expect(box.getByText('AI-written from the decision above. It cannot change it.')).toBeVisible();
  await expect(box.getByText('This follows from the fixed rules applied to your answers.')).toBeVisible();

  const sent = (await (await request.get(STUB)).json()) as { body: any }[];
  const explain = sent.filter((r) => String(r.body.messages?.[0]?.content).includes('<decision>')).at(-1)!;
  const user = String(explain.body.messages[0].content);
  if (SUPPORT_TRIAGE.description) expect(user).not.toContain(SUPPORT_TRIAGE.description.slice(0, 30));

  const forged = await page.evaluate(async (w) => {
    const r = await fetch('/api/agents/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ w, outcome: 'build_ai' }) });
    return r.json();
  }, encoded);
  const real = await page.evaluate(async (w) => (await (await fetch('/api/agents/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ w }) })).json()), encoded);
  expect(forged.outcome).toBe(real.outcome);
});

test('agent routes refuse cross-site requests and publish the inventory', async ({ request }) => {
  const cross = await request.post('/api/agents/intake', { headers: { origin: 'https://evil.example' }, data: { text: 'a long enough description of the job' } });
  expect(cross.status()).toBe(403);
  const inv = await (await request.get('/api/agents')).json();
  expect(inv.enabled).toBe(true);
  expect(inv.inventory.map((a: { name: string }) => a.name)).toEqual(['intake-interpreter', 'decision-explainer', 'price-verifier', 'registry-verifier']);
  for (const a of inv.inventory) expect(a.changes).toMatch(/^Nothing\./);
});
