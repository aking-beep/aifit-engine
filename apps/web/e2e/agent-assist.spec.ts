import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// AI assistance on the task check. The real API runs with agents off, so the
// first test checks nothing appears. The second intercepts the three agent
// endpoints in the browser with fixed replies (no model is called) to check
// the interface contract: nothing is applied until the person clicks Apply,
// and the decision still comes from the real rules endpoint.

test("with agents off, the task check shows no AI controls", async ({ page }) => {
  await page.goto("/check");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /suggest answers/i })).toHaveCount(0);
});

test("suggestions apply only on click and the rules still decide", async ({ page }) => {
  await page.route("**/v1/agents", (r) => r.fulfill({ json: { enabled: true, reason: "on" } }));
  await page.route("**/v1/agents/intake", (r) =>
    r.fulfill({
      json: {
        status: "ok",
        suggestions: [
          { field: "workTypes", value: ["generate"], evidence: "write cover letters", confidence: "high" },
          { field: "minutesPerOccurrence", value: 45, evidence: "45 minutes each", confidence: "high" },
        ],
        questions: ["What happens if a letter has a mistake?"],
      },
    }),
  );
  let explainBody: Record<string, unknown> | null = null;
  await page.route("**/v1/agents/explain", async (r) => {
    explainBody = r.request().postDataJSON();
    await r.fulfill({
      json: { status: "ok", outcome: "buy_ai", explanation: { source: "model", summary: "A ready-made writing tool fits.", keyPoints: [] } },
    });
  });

  await page.goto("/check");
  await page.getByLabel(/what do you want help with/i).fill("I write cover letters, 45 minutes each, about 8 a month.");
  await page.getByRole("button", { name: /suggest answers/i }).click();
  await expect(page.getByText("Because you wrote “write cover letters”")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Writing or drafting" })).not.toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Minutes each time" })).toHaveValue("");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page.getByRole("button", { name: "Apply Kind of work: generate" }).click();
  await page.getByRole("button", { name: "Apply Minutes each time: 45" }).click();
  await expect(page.getByRole("checkbox", { name: "Writing or drafting" })).toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Minutes each time" })).toHaveValue("45");

  await page.getByLabel("Times a month").fill("8");
  await page.getByLabel("I avoid tech setup").check();
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByTestId("decision-result").getByRole("heading", { level: 2 })).toHaveText("Use an AI tool");

  await page.getByRole("button", { name: /explain this result/i }).click();
  await expect(page.getByText(/AI-written from the result above/)).toBeVisible();
  await expect(page.getByText("A ready-made writing tool fits.")).toBeVisible();
  expect(explainBody).not.toBeNull();
  expect((explainBody as unknown as Record<string, unknown>).goal).toBe("");
});
