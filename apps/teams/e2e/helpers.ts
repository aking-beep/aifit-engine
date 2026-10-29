import { expect, type Page } from '@playwright/test';
import { INVOICE_LOOKUP, SUPPORT_TRIAGE, Workload, urlCodec } from '@aifit/teams-core';

const codec = urlCodec(Workload);
export const TRIAGE_LINK = `/report?w=${codec.encode(SUPPORT_TRIAGE)}`;
export const LOOKUP_LINK = `/report?w=${codec.encode(INVOICE_LOOKUP)}`;
export const PASSWORD = 'correct horse battery staple';

let n = 0;
export function uniqueEmail(tag: string) {
  return `${tag}-${Date.now()}-${n++}@example.com`;
}

export async function signUp(page: Page, email: string, name = 'Test Person', orgName = 'Test Co') {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Workspace name').fill(orgName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: orgName })).toBeVisible();
}

export async function saveTriage(page: Page) {
  await page.goto(TRIAGE_LINK);
  await page.getByRole('button', { name: 'Save to workspace' }).click();
  await expect(page.getByText(/Saved as version 1/)).toBeVisible();
  await page.getByRole('link', { name: 'Open it in the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Support ticket triage/i })).toBeVisible();
}

/**
 * Authenticated API call from inside the page. Under `next start` the session
 * cookie is Secure: the browser sends it to 127.0.0.1, but Playwright's own
 * request client does not over plain HTTP, so signed-in calls go through fetch.
 */
export async function pageApi(page: Page, path: string): Promise<{ status: number; body: any }> {
  return page.evaluate(async (p) => {
    const r = await fetch(p, { credentials: 'same-origin' });
    const text = await r.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { status: r.status, body };
  }, path);
}

/** From a prefilled intake (?w=...), walk to the last step and generate the report. */
export async function finishIntake(page: Page) {
  for (let i = 0; i < 10; i++) {
    const latency = page.getByRole('radio', { name: /A few seconds/ });
    if (await latency.isVisible() && !(await latency.isChecked())) await latency.click();
    const generate = page.getByRole('button', { name: 'Generate the report' });
    if (await generate.isVisible()) return generate.click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  throw new Error('Never reached the last intake step.');
}
