import { expect, test } from "@playwright/test";

test("landing, privacy, registry, and scored sample", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /which ai products fit/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /start the assessment/i })).toBeVisible();

  await page.getByRole("link", { name: "Privacy" }).first().click();
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/anonymous mode/i)).toBeVisible();

  await page.getByRole("link", { name: "Registry" }).first().click();
  await expect(page.getByRole("heading", { name: /product and model registry/i })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: /see a scored sample/i }).click();
  await expect(page.getByText(/interaction signature/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Primary stack/i)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible();
  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByText(/observations across/i).first()).toBeVisible();
});

test("assessment intro gate", async ({ page }) => {
  await page.goto("/assessment");
  await expect(page.getByRole("heading", { name: /before you start/i })).toBeVisible();
  await expect(page.getByText(/not your personality/i)).toBeVisible();
  await page.getByRole("button", { name: /begin scenario 1/i }).click();
  await expect(page.getByText(/scenario 1 of 8/i)).toBeVisible();
});
