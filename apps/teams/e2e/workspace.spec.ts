import { expect, test } from '@playwright/test';
import { PASSWORD, TRIAGE_LINK, finishIntake, pageApi, saveTriage, signUp, uniqueEmail } from './helpers';

test('sign up, save, reassess into version 2, download deliverables', async ({ page }) => {
  await signUp(page, uniqueEmail('owner'), 'Olive Owner', 'Olive Co');
  await saveTriage(page);
  await expect(page.getByText('Version 1').first()).toBeVisible();

  const json = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Blueprint (JSON)' }).click();
  const bp = JSON.parse(Buffer.concat(await (await (await json).createReadStream()).toArray()).toString('utf8'));
  expect(bp.kind).toBe('aifit.teams.blueprint');
  expect(bp.meta.assessment.version).toBe(1);
  expect(bp.validation.status).toBe('not_validated');

  const exp = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Governance export (JSON)' }).click();
  const doc = JSON.parse(Buffer.concat(await (await (await exp).createReadStream()).toArray()).toString('utf8'));
  expect(doc.enforcement).toBe('recommended-not-enforced');

  await page.getByRole('link', { name: /Reassess/ }).click();
  await expect(page).toHaveURL(/reassess=asm_/);
  await finishIntake(page);
  await page.getByRole('button', { name: 'Save as a new version' }).click();
  await expect(page.getByText(/Saved as version 2/)).toBeVisible();
  await page.goto('/workspace');
  await expect(page.getByText(/Version 2 of 2/)).toBeVisible();
});

test('another organisation cannot see or download a saved assessment', async ({ browser }) => {
  const a = await browser.newPage();
  await signUp(a, uniqueEmail('a'), 'Ann', 'Acme');
  await saveTriage(a);
  const savedUrl = a.url();
  const id = savedUrl.split('/').pop()!;

  const b = await browser.newPage();
  await signUp(b, uniqueEmail('b'), 'Ben', 'Globex');
  const res = await b.goto(savedUrl);
  expect(res?.status()).toBe(404);
  expect((await pageApi(b, `/api/assessments/${id}/blueprint?format=json`)).status).toBe(404);
  expect((await pageApi(b, `/api/assessments/${id}`)).status).toBe(404);
  await b.goto('/workspace');
  await expect(b.getByText('Nothing saved yet.')).toBeVisible();
});

test('invite a viewer: they can read but not download or save', async ({ browser }) => {
  const owner = await browser.newPage();
  const viewerEmail = uniqueEmail('viewer');
  await signUp(owner, uniqueEmail('owner'), 'Ola', 'Shared Co');
  await saveTriage(owner);
  const savedUrl = owner.url();
  await owner.goto('/workspace');
  await owner.getByLabel('Email to invite').fill(viewerEmail);
  await owner.getByLabel('Role').selectOption('viewer');
  await owner.getByRole('button', { name: 'Create invite link' }).click();
  const link = await owner.getByLabel(/Send this link/).inputValue();
  expect(link).toContain('/invite#token=');

  const viewer = await browser.newPage();
  await signUp(viewer, viewerEmail, 'Vic', 'Vic Co');
  await viewer.goto(link);
  await viewer.getByRole('button', { name: 'Join the workspace' }).click();
  await expect(viewer.getByRole('heading', { level: 1, name: 'Shared Co' })).toBeVisible();
  await viewer.goto(savedUrl);
  await expect(viewer.getByText(/Viewers can read reports but not download/)).toBeVisible();
  expect((await pageApi(viewer, `${new URL(savedUrl).pathname.replace('/workspace/assessments/', '/api/assessments/')}/blueprint`)).status).toBe(403);
  await viewer.goto(TRIAGE_LINK);
  await viewer.getByRole('button', { name: 'Save to workspace' }).click();
  await expect(viewer.getByText(/cannot do that here/)).toBeVisible();
});

test('sign out, sign back in, wrong password refused', async ({ page }) => {
  const email = uniqueEmail('login');
  await signUp(page, email, 'Lee', 'Lee Co');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/signin/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('not the password at all');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/do not match an account/)).toBeVisible();
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lee Co' })).toBeVisible();
});

test('export my data, then delete my account', async ({ page }) => {
  const email = uniqueEmail('delete');
  await signUp(page, email, 'Del', 'Del Co');
  await page.goto('/account');
  const { body: data } = await pageApi(page, '/api/account');
  expect(data.user.email).toBe(email);
  expect(JSON.stringify(data)).not.toContain('scrypt$');
  await page.getByLabel(/Type .* to confirm/).fill(email);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3011/');
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/do not match an account/)).toBeVisible();
});
