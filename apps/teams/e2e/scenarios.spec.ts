import { expect, test } from '@playwright/test';
import { pageApi, saveTriage, signUp, uniqueEmail } from './helpers';

// AI Fit 2.0 release scenarios 4 and 6, end to end through the Teams app with
// billing off. Scenario 5 (paid assessment) is billing-scenario.spec.ts.

test('scenario 4 — enterprise AI workload: architecture, technology, cost, governance, evaluation, roadmap', async ({ page }) => {
  await signUp(page, uniqueEmail('ent'), 'Eve', 'Enterprise Co');
  await saveTriage(page);
  const base = page.url();
  const id = base.split('/').pop()!;

  await page.goto(`${base}/architecture`);
  await expect(page.getByRole('heading', { level: 1, name: /^Architecture$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /API gateway/ }).first()).toBeVisible();
  await page.goto(`${base}/models`);
  await expect(page.getByRole('table', { name: /Recommended models/ }).getByText('Primary')).toBeVisible();
  await page.goto(`${base}/cost`);
  await expect(page.getByRole('heading', { level: 1, name: /Cost model/ })).toBeVisible();
  await expect(page.getByText(/\$[\d,.]+[kKmM]?/).first()).toBeVisible();
  await page.goto(`${base}/governance`);
  await expect(page.getByText('Recommended, not enforced')).toBeVisible();
  await page.goto(`${base}/evaluation`);
  await expect(page.getByText('Nothing here has been measured yet')).toBeVisible();
  await page.goto(`${base}/roadmap`);
  await expect(page.getByRole('heading', { level: 1, name: /^Roadmap$/ })).toBeVisible();

  // The same decisions, as the downloadable blueprint.
  const md = await pageApi(page, `/api/assessments/${id}/blueprint?format=md`);
  expect(md.status).toBe(200);
  for (const s of ['3. Architecture', '4. Model and infrastructure', '5. Cost and operating expense', '6. Security, privacy and governance', '7. Evaluation plan and acceptance criteria', '8. Implementation milestones']) {
    expect(md.body as string).toContain(`## ${s}`);
  }
  const control = await pageApi(page, `/api/assessments/${id}/control-export`);
  expect(control.status).toBe(200);
});

test('scenario 6 — two organisations: no cross-access to assessments or artifacts', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signUp(a, uniqueEmail('orga'), 'Ann', 'Org A');
  await saveTriage(a);
  const aUrl = a.url();
  const aId = aUrl.split('/').pop()!;
  await signUp(b, uniqueEmail('orgb'), 'Ben', 'Org B');
  await saveTriage(b);
  const bId = b.url().split('/').pop()!;

  for (const [viewer, otherId, otherUrl] of [[b, aId, aUrl], [a, bId, b.url()]] as const) {
    expect((await viewer.goto(otherUrl))?.status()).toBe(404);
    for (const path of ['', '/blueprint?format=json', '/blueprint?format=md', '/control-export', '/risks']) {
      expect((await pageApi(viewer, `/api/assessments/${otherId}${path}`)).status, path || 'record').toBe(404);
    }
    const patch = await viewer.evaluate(async (id) => (await fetch(`/api/assessments/${id}/risks`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ riskId: 'X', edit: { status: 'closed' } }),
    })).status, otherId);
    expect(patch).toBe(404);
  }
  await a.goto('/workspace/portfolio');
  await expect(a.getByRole('button', { name: /Support ticket triage/ })).toHaveCount(1);
});
