import { expect, test } from "@playwright/test";

test("public MVP is not gated by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /find the ai that fits you/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /fit is opening in waves/i })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
});

test("waitlist gate covers the quiz and leaves privacy public", async ({ page }) => {
  await page.route("**/v1/access", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { mode: "waitlist", note: "Invite first for finish-rate learning." } });
      return;
    }
    await route.continue();
  });
  await page.route("**/v1/waitlist", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { ok: true, id: "wait-1" } });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /fit is opening in waves/i })).toBeVisible();
  await expect(page.getByText(/invite first for finish-rate learning/i)).toBeVisible();
  await page.getByLabel("Email").fill("founder@example.com");
  await page.getByRole("button", { name: /save my spot/i }).click();
  await expect(page.getByText(/you are on the list/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /find the ai that fits you/i })).toHaveCount(0);

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/optional waitlist/i)).toBeVisible();
});

test("access code unlocks the quiz", async ({ page }) => {
  await page.route("**/v1/access", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { mode: "code", note: "" } });
      return;
    }
    await route.continue();
  });
  await page.route("**/v1/access/unlock", async (route) => {
    const body = route.request().postDataJSON() as { code?: string };
    if (body.code?.toLowerCase() === "let-me-in") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ status: 403, body: "That code is not on the list" });
  });

  await page.goto("/assessment");
  await expect(page.getByRole("heading", { name: /enter your access code/i })).toBeVisible();
  await page.getByLabel("Code").fill("let-me-in");
  await page.getByRole("button", { name: /open fit/i }).click();
  await expect(page.getByRole("heading", { name: /find your ai fit/i })).toBeVisible();
});
