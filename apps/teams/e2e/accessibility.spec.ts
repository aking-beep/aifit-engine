import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LOOKUP_LINK, TRIAGE_LINK, saveTriage, signUp, uniqueEmail } from './helpers';

// Automated WCAG 2.1 A/AA checks with axe-core; a subset of what an audit covers.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: import('@playwright/test').Page) {
  // Next streams metadata after a client-side navigation; scan once it has landed.
  await expect(page).toHaveTitle(/AI Fit Teams/);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help} — ${v.nodes[0]?.target.join(' ')}`);
}

for (const path of ['/', '/assess', '/methodology', '/privacy', '/signin', '/signup', TRIAGE_LINK, LOOKUP_LINK]) {
  test(`no axe violations on ${path.slice(0, 40)}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await scan(page)).toEqual([]);
  });
}

test('no axe violations on the workspace and a saved assessment', async ({ page }) => {
  await signUp(page, uniqueEmail('a11y'), 'Ada', 'Access Co');
  expect(await scan(page)).toEqual([]);
  await saveTriage(page);
  expect(await scan(page)).toEqual([]);
  await page.goto('/account');
  expect(await scan(page)).toEqual([]);
});
