import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SUPPORT_TRIAGE, Workload, urlCodec } from '@aifit/teams-core';
import { pageApi, saveTriage, signUp, uniqueEmail } from './helpers';

// Every assessment section, on a saved assessment and from a link, with billing
// off (the default deployment). Figures come from the engines; the assertions
// check the sections render real output and pass automated WCAG checks.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SECTIONS: [string, RegExp][] = [
  ['build-vs-buy', /Build vs buy vs automate/],
  ['cost', /Cost model/],
  ['roi', /^ROI$/],
  ['architecture', /^Architecture$/],
  ['models', /^Models$/],
  ['infrastructure', /^Infrastructure$/],
  ['governance', /^Governance$/],
  ['security', /^Security$/],
  ['risks', /Risk register/],
  ['evaluation', /Evaluation plan|Test plan/],
  ['roadmap', /^Roadmap$/],
  ['blueprint', /Technical blueprint/],
];

async function axe(page: import('@playwright/test').Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.help} — ${v.nodes[0]?.target.join(' ')}`);
}

test('a saved assessment: every section renders from the engines and passes axe', async ({ page }) => {
  await signUp(page, uniqueEmail('sections'), 'Sam', 'Sections Co');
  await saveTriage(page);
  const base = page.url();
  for (const [slug, heading] of SECTIONS) {
    await page.goto(`${base}/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Assessment sections' }).getByRole('link', { name: new RegExp(`^${slug === 'build-vs-buy' ? 'Build vs buy' : slug === 'roi' ? 'ROI' : slug[0]!.toUpperCase() + slug.slice(1)}`, 'i') })).toHaveAttribute('aria-current', 'page');
    expect(await axe(page), slug).toEqual([]);
  }
  // Spot checks that the content is the engine's, not placeholder copy.
  await page.goto(`${base}/models`);
  await expect(page.getByRole('table', { name: /Recommended models/ }).getByText('Primary')).toBeVisible();
  await page.goto(`${base}/evaluation`);
  await expect(page.getByText('Nothing here has been measured yet')).toBeVisible();
  await page.goto(`${base}/governance`);
  await expect(page.getByText('Recommended, not enforced')).toBeVisible();
  await expect(page.getByText(/^0 of \d+$/)).toBeVisible();
});

test('the architecture diagram is interactive and the ROI explorer recomputes', async ({ page }) => {
  await signUp(page, uniqueEmail('arch'), 'Ari', 'Arch Co');
  await saveTriage(page);
  const base = page.url();
  await page.goto(`${base}/architecture`);
  await page.getByRole('button', { name: /API gateway/ }).first().click();
  await expect(page.getByText('Authenticates callers, logs every request, enforces rate and spend limits.')).toBeVisible();
  await page.goto(`${base}/roi`);
  const net = page.locator('dl[aria-live] dd').first();
  const before = await net.textContent();
  const slider = page.getByLabel('Share of the task AI removes');
  await slider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByText('What-if values, not saved.')).toBeVisible();
  await expect(net).not.toHaveText(before ?? '');
});

test('risk register edits persist for members and are refused for other workspaces', async ({ page, browser }) => {
  await signUp(page, uniqueEmail('risk'), 'Rita', 'Risk Co');
  await saveTriage(page);
  const id = page.url().split('/').pop()!;
  await page.goto(`/workspace/assessments/${id}/risks`);
  const firstRisk = page.getByRole('table', { name: /Risks/ }).getByRole('button').first();
  await firstRisk.click();
  await page.getByLabel('Owner').fill('Priya N.');
  await page.getByLabel('Status').selectOption('mitigating');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Risk updated')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('table', { name: /Risks/ }).getByText('Priya N.')).toBeVisible();

  const other = await browser.newPage();
  await signUp(other, uniqueEmail('risk-b'), 'Bo', 'Other Co');
  const res = await other.evaluate(async (path) => (await fetch(path, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ riskId: 'X', edit: { status: 'closed' } }) })).status, `/api/assessments/${id}/risks`);
  expect(res).toBe(404);
  expect((await pageApi(other, `/api/assessments/${id}/risks`)).status).toBe(404);
});

test('the workspace profile pre-fills new intakes, and the dashboard and portfolio list saved work', async ({ page }) => {
  await signUp(page, uniqueEmail('profile'), 'Pia', 'Profile Co');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await page.getByLabel('Industry').fill('Logistics');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('checkbox', { name: /Health information/ }).click();
  await page.getByLabel('Where data must stay').selectOption('eu');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Engineers who could build and run this').fill('3');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/assess$/);
  // A new intake starts from the profile (data classes are on step 5, residency on 6).
  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.includes('intake')) ?? '') ?? 'null'));
  expect(state?.state?.dataClasses).toContain('phi');
  expect(state?.state?.dataResidency).toBe('eu');
  expect(state?.state?.engineers).toBe(3);

  await saveTriage(page);
  await page.goto('/workspace');
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
  await page.goto('/workspace/portfolio');
  await page.getByRole('button', { name: /Support ticket triage/ }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Open assessment' })).toBeVisible();
  await page.goto('/workspace/history');
  await expect(page.getByRole('table', { name: 'Assessment versions' }).getByText('Current')).toBeVisible();
});

test('the report from a link renders sections without an account', async ({ page }) => {
  const w = urlCodec(Workload).encode(SUPPORT_TRIAGE);
  await page.goto(`/report/cost?w=${w}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Cost model' })).toBeVisible();
  await page.goto(`/report/blueprint?w=${w}`);
  await expect(page.getByRole('tab', { name: /blueprint\.md|\.md$/ }).first()).toBeVisible();
  expect(await axe(page)).toEqual([]);
});
