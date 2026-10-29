import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { TRIAGE_LINK, pageApi, saveTriage, signUp, uniqueEmail } from './helpers';

// Section access with billing on (test mode, fake Stripe keys). Every purchase,
// refund and subscription change arrives as a locally signed webhook; nothing
// reaches Stripe. Locked sections must not send their content at all.

const SECRET = 'whsec_e2e_local_signing_only';
const now = () => Math.floor(Date.now() / 1000);
let n = 0;

async function webhook(request: APIRequestContext, type: string, object: Record<string, unknown>, created = now()) {
  const body = JSON.stringify({ id: `evt_${Date.now()}_${n++}`, type, created, livemode: false, data: { object } });
  const t = now();
  const sig = `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
  const res = await request.post('/api/billing/webhook', { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': sig } });
  expect(res.status()).toBe(200);
  return res.json();
}

async function saved(page: Page, tag: string) {
  await signUp(page, uniqueEmail(tag), 'Pat', `${tag} Co`);
  await saveTriage(page);
  const id = page.url().split('/').pop()!;
  const { assessment } = (await pageApi(page, `/api/assessments/${id}`)).body;
  return { id, orgId: assessment.orgId as string, rootId: assessment.rootId as string, base: `/workspace/assessments/${id}` };
}

async function locked(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: /^Included with / })).toBeVisible();
}

async function open(page: Page, path: string, heading: RegExp) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

test('free sections are open; paid sections are locked and send no content', async ({ page }) => {
  const a = await saved(page, 'gate');
  await open(page, `${a.base}/build-vs-buy`, /Build vs buy/);
  await locked(page, `${a.base}/cost`);
  await expect(page.getByText('Call shape behind the cost')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Buy assessment for this workload' })).toBeVisible();
  await locked(page, `${a.base}/architecture`);
  await expect(page.getByRole('button', { name: 'Buy blueprint for this workload' })).toBeVisible();
  // Signed in, on the real page: the locked section's content is absent from the HTML, not just hidden.
  await locked(page, `${a.base}/security`);
  const html = await page.evaluate(async (path) => (await fetch(path, { credentials: 'same-origin' })).text(), `${a.base}/security`);
  expect(html).toContain('Included with');
  expect(html).not.toContain('How ARC Control verifies it at runtime');
  // The anonymous report is free sections only when billing is on.
  await page.goto(TRIAGE_LINK.replace('/report?', '/report/roi?'));
  await expect(page.getByRole('heading', { name: /^Included with / })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Save this assessment to a workspace first' })).toBeVisible();
});

test('assessment purchase, then blueprint purchase, then a full refund takes the blueprint away', async ({ page }) => {
  const a = await saved(page, 'buy');
  const meta = (product: string) => ({ orgId: a.orgId, product, assessmentRootId: a.rootId });
  await webhook(page.request, 'checkout.session.completed', { id: `cs_as_${n}`, payment_status: 'paid', payment_intent: 'pi_as', amount_total: 14900, currency: 'usd', metadata: meta('assessment') });
  await open(page, `${a.base}/cost`, /Cost model/);
  await open(page, `${a.base}/risks`, /Risk register/);
  await locked(page, `${a.base}/architecture`);

  await webhook(page.request, 'checkout.session.completed', { id: `cs_bp_${n}`, payment_status: 'paid', payment_intent: 'pi_bp', amount_total: 39900, currency: 'usd', metadata: meta('blueprint') });
  await open(page, `${a.base}/architecture`, /^Architecture$/);
  expect((await pageApi(page, `/api/assessments/${a.id}/blueprint`)).status).toBe(200);

  await webhook(page.request, 'charge.refunded', { id: 'ch_bp', payment_intent: 'pi_bp', refunded: true, amount_refunded: 39900, currency: 'usd', metadata: meta('blueprint') });
  expect((await pageApi(page, `/api/assessments/${a.id}/blueprint`)).status).toBe(402);
  await locked(page, `${a.base}/architecture`);
  await open(page, `${a.base}/cost`, /Cost model/); // the assessment purchase still stands

  await page.goto('/workspace/billing');
  const history = page.getByRole('table', { name: 'Payment history' });
  await expect(history.getByText('refunded')).toBeVisible();
  await expect(history.getByText('$399.00').first()).toBeVisible();
  await expect(history.getByText('$149.00')).toBeVisible();
});

test('workspace subscription unlocks everything; cancellation ends it at the period end', async ({ page }) => {
  const a = await saved(page, 'sub');
  await webhook(page.request, 'checkout.session.completed', { id: `cs_team_${n}`, payment_status: 'paid', subscription: 'sub_e2e', customer: 'cus_e2e', amount_total: 19900, currency: 'usd', metadata: { orgId: a.orgId, product: 'team' } });
  const end = now() + 30 * 86400;
  await webhook(page.request, 'customer.subscription.updated', { id: 'sub_e2e', customer: 'cus_e2e', status: 'active', current_period_end: end, metadata: { orgId: a.orgId, product: 'team' } });
  await open(page, `${a.base}/roadmap`, /^Roadmap$/);
  expect((await pageApi(page, `/api/assessments/${a.id}/control-export`)).status).toBe(200);

  await webhook(page.request, 'customer.subscription.updated', { id: 'sub_e2e', customer: 'cus_e2e', status: 'active', current_period_end: end, cancel_at_period_end: true, metadata: { orgId: a.orgId, product: 'team' } });
  await page.goto('/workspace/billing');
  await expect(page.getByText('Plan ends at the close of the paid period')).toBeVisible();
  await open(page, `${a.base}/roadmap`, /^Roadmap$/);

  await webhook(page.request, 'customer.subscription.deleted', { id: 'sub_e2e', customer: 'cus_e2e', status: 'canceled', ended_at: now(), metadata: { orgId: a.orgId, product: 'team' } });
  await locked(page, `${a.base}/roadmap`);
  expect((await pageApi(page, `/api/assessments/${a.id}/control-export`)).status).toBe(402);
});

test('a failed checkout and a cancelled checkout grant nothing', async ({ page }) => {
  const a = await saved(page, 'fail');
  await webhook(page.request, 'checkout.session.async_payment_failed', { id: `cs_f_${n}`, metadata: { orgId: a.orgId, product: 'assessment', assessmentRootId: a.rootId } });
  await webhook(page.request, 'checkout.session.expired', { id: `cs_x_${n}`, metadata: { orgId: a.orgId, product: 'blueprint', assessmentRootId: a.rootId } });
  await locked(page, `${a.base}/cost`);
  await page.goto('/billing?status=cancelled');
  await expect(page.getByText(/Checkout was cancelled. Nothing was charged./)).toBeVisible();
  await page.goto('/workspace/billing');
  const history = page.getByRole('table', { name: 'Payment history' });
  await expect(history.getByText('failed')).toBeVisible();
  await expect(history.getByText('expired')).toBeVisible();
});
