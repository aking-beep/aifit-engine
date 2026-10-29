import { expect, test } from '@playwright/test';
import { LOOKUP_LINK, TRIAGE_LINK } from './helpers';

test('a full intake in the browser produces a report with a verdict and the five-option comparison', async ({ page }) => {
  await page.goto('/assess');
  await page.getByLabel('Name').fill('Draft replies to supplier emails');
  await page.getByRole('button', { name: /Generate/ }).first().click();
  await page.getByRole('button', { name: /Summarise/ }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Units per month').fill('1200');
  await page.getByLabel('What is a unit called?').fill('email');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Input tokens per unit').fill('900');
  await page.getByLabel('Output tokens per unit').fill('300');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: /A band of acceptable answers/ }).click();
  await page.getByRole('radio', { name: /Annoying/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /^Internal/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: /A few seconds/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Minutes a person spends per unit').fill('6');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Engineers who could work on this').fill('2');
  await page.getByLabel('Monthly budget').fill('1500');
  await page.getByLabel('Weeks until it must work').fill('10');
  await page.getByRole('button', { name: 'Generate the report' }).click();

  await expect(page).toHaveURL(/\/report\?w=/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const decision = page.getByTestId('decision-section');
  await expect(decision).toBeVisible();
  await expect(decision.getByRole('list', { name: 'Options compared' }).getByRole('listitem')).toHaveCount(5);
});

test('lookup-only work: do not use a model, and no option is AI', async ({ page }) => {
  await page.goto(LOOKUP_LINK);
  await expect(page.getByRole('heading', { level: 1, name: /Do not use a model/ })).toBeVisible();
  const outcome = await page.getByTestId('decision-section').locator('[data-outcome]').getAttribute('data-outcome');
  expect(['no_change', 'conventional_software', 'conventional_automation']).toContain(outcome);
  await expect(page.getByText('HC_DETERMINISTIC_ONLY').first()).toBeVisible();
});

test('without an account the report is complete and the blueprint downloads (billing off)', async ({ page }) => {
  await page.goto(TRIAGE_LINK);
  await expect(page.getByTestId('decision-section')).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign in to save/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download blueprint (Markdown)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^blueprint-.*\.md$/);
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(text.startsWith('# Technical blueprint')).toBe(true);
  expect(text).toContain('## 7. Evaluation plan and acceptance criteria');
});

test('a corrupted report link fails safely', async ({ page }) => {
  await page.goto('/report?w=not-a-real-link');
  await expect(page.getByRole('heading', { name: /did not resolve/ })).toBeVisible();
});
