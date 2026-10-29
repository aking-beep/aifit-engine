import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { pageApi, saveTriage, signUp, uniqueEmail } from './helpers';

// AI Fit 2.0 release scenario 5 on the Stripe test-mode server (fake keys,
// locally signed webhooks; nothing reaches Stripe).

const SECRET = 'whsec_e2e_local_signing_only';
const now = () => Math.floor(Date.now() / 1000);

test('scenario 5 — paid assessment: test payment, entitlement granted, blueprint downloaded', async ({ page }) => {
  await signUp(page, uniqueEmail('paid'), 'Pia', 'Paid Co');
  await saveTriage(page);
  const id = page.url().split('/').pop()!;
  const { assessment } = (await pageApi(page, `/api/assessments/${id}`)).body;
  const meta = { orgId: assessment.orgId, product: 'blueprint', assessmentRootId: assessment.rootId };

  // Before payment: locked, and the download is refused.
  expect((await pageApi(page, `/api/assessments/${id}/blueprint?format=md`)).status).toBe(402);
  await page.goto(`/workspace/assessments/${id}/blueprint`);
  await expect(page.getByRole('button', { name: 'Buy blueprint for this workload' })).toBeVisible();

  const body = JSON.stringify({ id: `evt_scn5_${Date.now()}`, type: 'checkout.session.completed', created: now(), livemode: false, data: { object: {
    id: `cs_scn5_${Date.now()}`, payment_status: 'paid', payment_intent: `pi_scn5_${Date.now()}`, amount_total: 99900, currency: 'usd', metadata: meta,
  } } });
  const t = now();
  const sig = `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
  const res = await page.request.post('/api/billing/webhook', { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': sig } });
  expect(res.status()).toBe(200);

  const md = await pageApi(page, `/api/assessments/${id}/blueprint?format=md`);
  expect(md.status).toBe(200);
  expect(md.body as string).toContain('## 3. Architecture');
  await page.goto(`/workspace/assessments/${id}`);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Blueprint (Markdown)' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  await page.goto('/workspace/billing');
  await expect(page.getByRole('table', { name: 'Payment history' }).getByText('$999.00')).toBeVisible();
});
