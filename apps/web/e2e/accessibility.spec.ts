import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated WCAG 2.1 A/AA checks with axe-core. Automated checks catch a
// subset of accessibility problems; they are not a substitute for an audit.

const PAGES = ["/", "/assessment", "/check", "/history", "/methodology", "/privacy", "/registry"];

for (const path of PAGES) {
  test(`no axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
  });
}

test("no axe violations on a task-check result", async ({ page }) => {
  await page.goto("/check");
  await page.getByLabel("Writing or drafting").check();
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByTestId("decision-result")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
});

test("no axe violations on quiz results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /see an example/i }).click();
  await expect(page.getByText(/Fit score/i)).toBeVisible({ timeout: 20_000 });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });
  for (const path of ["/", "/check", "/history"]) {
    test(`no axe violations on ${path} (dark)`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveClass(/dark/);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
    });
  }
});
