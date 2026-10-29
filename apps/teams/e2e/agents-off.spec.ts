import { expect, test } from '@playwright/test';
import { SUPPORT_TRIAGE, Workload, urlCodec } from '@aifit/teams-core';
import { TRIAGE_LINK } from './helpers';

// The default deployment: agents off. No AI controls appear, and the routes
// answer with the rule-based behaviour instead of calling anything.

test('with agents off there are no AI controls and the routes say so', async ({ page }) => {
  await page.goto(TRIAGE_LINK);
  await expect(page.getByTestId('decision-section')).toBeVisible();
  await expect(page.getByTestId('explain-decision')).toHaveCount(0);
  await page.goto(`/assess?w=${urlCodec(Workload).encode(SUPPORT_TRIAGE)}`);
  await expect(page.getByRole('button', { name: /suggest answers/i })).toHaveCount(0);

  const res = await page.evaluate(async (w) => {
    const post = (p: string, body: unknown) => fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    return {
      status: await fetch('/api/agents').then((r) => r.json()),
      intake: await post('/api/agents/intake', { text: 'a long enough description of the job' }),
      explain: await post('/api/agents/explain', { w }),
    };
  }, urlCodec(Workload).encode(SUPPORT_TRIAGE));
  expect(res.status.enabled).toBe(false);
  expect(res.intake.status).toBe('disabled');
  expect(res.explain.status).toBe('disabled');
  expect(res.explain.explanation.source).toBe('rules');
});
