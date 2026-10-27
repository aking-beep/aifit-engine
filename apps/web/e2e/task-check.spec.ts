import { expect, test } from "@playwright/test";

// The task check end to end: form → /v1/decision (Python engine) → result,
// saved to this browser's history, reopened from the history page.

test("a writing task recommends an AI tool and compares tools without inventing prices", async ({ page }) => {
  await page.goto("/check");
  await expect(page.getByRole("heading", { level: 1, name: /should you use ai for this/i })).toBeVisible();
  await page.getByLabel(/what do you want help with/i).fill("Cover letters for job applications");
  await page.getByLabel("Writing or drafting").check();
  await page.getByLabel("Summarising long things").check();
  await page.getByLabel("Times a month").fill("8");
  await page.getByLabel("Minutes each time").fill("45");
  await page.getByLabel("I avoid tech setup").check();
  await page.getByRole("button", { name: /check this task/i }).click();

  const result = page.getByTestId("decision-result");
  await expect(result.getByRole("heading", { level: 2 })).toHaveText("Use an AI tool");
  await expect(result.getByText(/all five options, compared/i)).toBeVisible();
  await expect(result.getByText(/no validation step has run/i)).toBeVisible();
  const tools = page.getByTestId("tool-comparison");
  await expect(tools).toBeVisible();
  await expect(tools.getByText(/\$\d/)).toHaveCount(0);
  await expect(page.getByText(/Fit never makes up prices/)).toBeVisible();

  await page.getByRole("link", { name: "Your history" }).click();
  await expect(page.getByRole("heading", { name: "Your history" })).toBeVisible();
  const entry = page.getByRole("link", { name: "Cover letters for job applications" });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.getByTestId("decision-result").getByRole("heading", { level: 2 })).toHaveText("Use an AI tool");
});

test("lookup-only work says not to use AI", async ({ page }) => {
  await page.goto("/check");
  await page.getByLabel("Finding a record I already have").check();
  await page.getByLabel("Totals and arithmetic").check();
  await page.getByLabel("Times a month").fill("200");
  await page.getByLabel("Minutes each time").fill("3");
  await page.getByLabel(/one exact right answer/i).check();
  await page.getByRole("button", { name: /check this task/i }).click();
  const heading = page.getByTestId("decision-result").getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(/Ordinary software|Rules-based automation/);
  await expect(page.getByText("HC_DETERMINISTIC_ONLY").first()).toBeVisible();
  await expect(page.getByTestId("tool-comparison")).toHaveCount(0);
});

test("contradictory answers are called out", async ({ page }) => {
  await page.goto("/check");
  await page.getByLabel("Writing or drafting").check();
  await page.getByLabel("Times a month").fill("0");
  await page.getByLabel("Minutes each time").fill("10");
  await page.getByLabel(/one exact right answer/i).check();
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByText(/some answers do not fit together/i)).toBeVisible();
  await expect(page.getByText(/confidence: low/i)).toBeVisible();
});

test("the form refuses an empty job and keeps the answers", async ({ page }) => {
  await page.goto("/check");
  await page.getByLabel("Times a month").fill("5");
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByText(/pick at least one kind of work/i)).toBeVisible();
  await expect(page.getByLabel("Times a month")).toHaveValue("5");
});

test("history can be cleared", async ({ page }) => {
  await page.goto("/check");
  await page.getByLabel("Writing or drafting").check();
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByTestId("decision-result")).toBeVisible();
  await page.goto("/history");
  await page.getByRole("button", { name: /delete everything/i }).click();
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();
});
