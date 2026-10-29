import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LEADS_TOKEN } from '../playwright.config';

// Ad landing pages, the ARC call to action, lead capture with campaign
// attribution, and the SEO surfaces. Billing off, file store (durable locally).

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const AUDIENCES = ['operations', 'it-security', 'small-business'];

for (const slug of AUDIENCES) {
  test(`landing page /for/${slug} renders, links to the intake and ARC, and passes axe`, async ({ page }) => {
    await page.goto(`/for/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /free|security-first|Check one job/i }).first()).toHaveAttribute('href', '/assess');
    await expect(page.getByRole('link', { name: 'Book an assessment call' })).toHaveAttribute('href', /calendly\.com\/aking-arctransformationgroup\/30min\?.*utm_source=ai-fit-teams/);
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('a lead keeps the campaign that brought the visitor and is exported to the operator', async ({ page, request }) => {
  await page.goto('/for/operations?utm_source=linkedin&utm_medium=paid&utm_campaign=q4-ops');
  // The outbound booking link carries the original campaign.
  await expect(page.getByRole('link', { name: 'Book an assessment call' })).toHaveAttribute('href', /utm_campaign=q4-ops/);
  await page.goto('/'); // first touch wins, even after navigating on
  await page.goto('/for/operations');
  const email = `lead-${Date.now()}@example.com`;
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Company (optional)').fill('Acme');
  await page.getByRole('checkbox', { name: /may email me/ }).check();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Thanks, we have it.')).toBeVisible();

  expect((await request.get('/api/leads')).status()).toBe(401);
  const res = await request.get('/api/leads', { headers: { authorization: `Bearer ${LEADS_TOKEN}` } });
  const lead = (await res.json()).leads.find((l: { email: string }) => l.email === email);
  expect(lead.company).toBe('Acme');
  expect(lead.source.page).toBe('for/operations');
  expect(lead.source.attribution.utm).toMatchObject({ utm_source: 'linkedin', utm_campaign: 'q4-ops' });
  const csv = await (await request.get('/api/leads?format=csv', { headers: { authorization: `Bearer ${LEADS_TOKEN}` } })).text();
  expect(csv).toContain(email);
});

test('the lead form refuses a missing consent and a cross-site post', async ({ page, request }) => {
  await page.goto('/for/small-business');
  await page.getByLabel('Work email').fill('noconsent@example.com');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Tick the box/)).toBeVisible();
  const forged = await request.post('/api/leads', { data: { email: 'x@example.com', interest: 'other', consent: true, source: { app: 'ai-fit-teams', page: 'x', attribution: null } }, headers: { origin: 'https://evil.example' } });
  expect(forged.status()).toBe(403);
});

test('the report and landing page offer ARC, and no cookie banner appears without ad pixels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Want ARC to do this with you?' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cookie consent' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Talk to ARC' })).toHaveAttribute('href', /calendly\.com.*utm_content=header/);
});

test('SEO surfaces: sitemap, robots, share images, legal pages', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const slug of AUDIENCES) expect(sitemap).toContain(`/for/${slug}`);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow: \/workspace/);
  const og = await request.get('/for/operations/opengraph-image-1uizub');
  expect(og.headers()['content-type']).toContain('image/png');
  await page.goto('/for/operations');
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toMatch(/opengraph-image/);
  for (const path of ['/terms', '/refunds']) {
    await page.goto(path);
    await expect(page.getByRole('note')).toContainText('Draft for review by counsel');
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`), path).toEqual([]);
  }
});

test('password reset says plainly when email is not set up', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/reset/);
  await expect(page.getByText('Password reset by email is not set up on this deployment yet.')).toBeVisible();
});
