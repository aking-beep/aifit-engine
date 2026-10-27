import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { pageApi, saveTriage, signUp, uniqueEmail } from './helpers';

// Matches STRIPE_WEBHOOK_SECRET in playwright.config.ts. Local signing only.
const SECRET = 'whsec_e2e_local_signing_only';

function sign(body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
}

async function webhook(request: APIRequestContext, event: object, signature?: string) {
  const body = JSON.stringify(event);
  return request.post('/api/billing/webhook', { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': signature ?? sign(body) } });
}

test('test-mode billing: locked until a signed webhook pays, once, for that assessment only', async ({ page }) => {
  await signUp(page, uniqueEmail('payer'), 'Pat', 'Paying Co');
  await expect(page.getByText(/Stripe test mode/)).toBeVisible();
  await saveTriage(page);
  await expect(page.getByText(/Buy this blueprint or start a team plan/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy this blueprint' })).toBeVisible();
  const id = page.url().split('/').pop()!;
  expect((await pageApi(page, `/api/assessments/${id}/blueprint`)).status).toBe(402);

  const detail = (await pageApi(page, `/api/assessments/${id}`)).body;
  const orgId = detail.assessment.orgId as string;
  const rootId = detail.assessment.rootId as string;
  const paid = {
    id: `evt_${Date.now()}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: { id: `cs_test_${Date.now()}`, payment_status: 'paid', metadata: { orgId, product: 'blueprint', assessmentRootId: rootId } } },
  };

  const forged = await webhook(page.request, paid, sign(JSON.stringify(paid)).replace(/v1=[0-9a-f]{64}/, `v1=${'0'.repeat(64)}`));
  expect(forged.status()).toBe(422);
  expect((await pageApi(page, `/api/assessments/${id}/blueprint`)).status).toBe(402);

  const first = await webhook(page.request, paid);
  expect(first.status()).toBe(200);
  expect((await first.json()).status).toBe('processed');
  const replay = await webhook(page.request, paid);
  expect((await replay.json()).status).toBe('duplicate');

  expect((await pageApi(page, `/api/assessments/${id}/blueprint`)).status).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Blueprint (Markdown)' })).toBeVisible();
  // The purchase is per assessment: the team-plan export stays locked.
  expect((await pageApi(page, `/api/assessments/${id}/control-export`)).status).toBe(402);
});

test('a live-mode event is ignored on a test deployment, and an old signature is refused', async ({ page }) => {
  await signUp(page, uniqueEmail('live'), 'Liv', 'Live Co');
  await saveTriage(page);
  const id = page.url().split('/').pop()!;
  const { assessment } = (await pageApi(page, `/api/assessments/${id}`)).body;
  const live = { id: `evt_live_${Date.now()}`, type: 'checkout.session.completed', created: 1, livemode: true, data: { object: { id: 'cs_live_x', payment_status: 'paid', metadata: { orgId: assessment.orgId, product: 'team' } } } };
  expect((await (await webhook(page.request, live)).json()).status).toBe('ignored');
  const old = { ...live, id: `evt_old_${Date.now()}`, livemode: false };
  expect((await webhook(page.request, old, sign(JSON.stringify(old), Math.floor(Date.now() / 1000) - 3600))).status()).toBe(422);
  expect((await pageApi(page, `/api/assessments/${id}/control-export`)).status).toBe(402);
});

test('cancelled checkout return page says nothing was charged', async ({ page }) => {
  await signUp(page, uniqueEmail('cancel'), 'Cal', 'Cancel Co');
  await page.goto('/billing?status=cancelled');
  await expect(page.getByText(/Checkout was cancelled. Nothing was charged./)).toBeVisible();
});

test('the anonymous blueprint route is closed once billing is on', async ({ request }) => {
  const res = await request.get('/api/blueprint?format=md&w=x');
  expect(res.status()).toBe(402);
});
