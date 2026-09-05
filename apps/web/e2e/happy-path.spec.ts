import { expect, test } from "@playwright/test";

test("landing, privacy, transparency, and scored sample", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /discover how you work with ai/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /build my ai profile/i })).toBeVisible();

  await page.getByRole("link", { name: "Privacy" }).first().click();
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/anonymous mode/i)).toBeVisible();

  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "How scoring works", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /open the seed registry/i })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: /see a sample profile/i }).click();
  await expect(page.getByText(/Workprint score/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: /evidence-driven operator/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /export my ai setup/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /configure my ai/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /interaction profile/i })).toBeVisible();
  await expect(page.getByText(/install in chatgpt/i).first()).toBeVisible();
});

test("assessment intro gate", async ({ page }) => {
  await page.goto("/assessment");
  await expect(page.getByRole("heading", { name: /build your ai workstyle/i })).toBeVisible();
  await expect(page.getByText(/about five minutes/i)).toBeVisible();
  await page.getByRole("button", { name: /begin diagnostic/i }).click();
  await expect(page.getByText(/scenario 1/i)).toBeVisible();
});
