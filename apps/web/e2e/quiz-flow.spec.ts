import { expect, test } from "@playwright/test";

test("quiz shows how many questions and advances on click", async ({ page }) => {
  await page.goto("/assessment");
  await expect(page.getByText(/four short scenes, about twelve questions/i)).toBeVisible();
  await page.getByRole("button", { name: /let's go/i }).click();

  await expect(page.getByText(/scene 1 of 4/i)).toBeVisible();
  await expect(page.getByText(/question 1 of about 12/i)).toBeVisible();
  await expect(page.getByText(/3 questions in this scene/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /continue/i })).toHaveCount(0);
  await expect(page.getByText(/no wrong answers/i)).toHaveCount(0);

  const firstChoice = page.getByRole("radio").first();
  await firstChoice.click();
  await expect(page.getByText(/question 2 of about 12/i)).toBeVisible({ timeout: 15_000 });
});
