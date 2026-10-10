import { expect, test } from "@playwright/test";

test("share link never carries the session id and cost filter has no no-op options", async ({ page }) => {
  await page.route("**/v1/share", (route) => route.fulfill({ status: 503, body: "unavailable" }));

  await page.goto("/");
  await page.getByRole("button", { name: /see an example/i }).click();
  await expect(page.getByRole("heading", { name: /start here/i })).toBeVisible({ timeout: 20_000 });
  const sessionId = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(sessionId.length).toBeGreaterThan(8);

  await page.getByText(/how we scored this/i).click();
  const cost = page.getByRole("group", { name: "Cost" });
  await expect(cost.getByRole("button", { name: "Any cost" })).toBeVisible();
  await expect(cost.getByRole("button", { name: /skip premium-only tools/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /max high cost/i })).toHaveCount(0);

  await page.getByRole("button", { name: /copy share link/i }).click();
  const link = page.getByRole("link", { name: /\/share\/profile#/ });
  const dialog = page.getByRole("dialog", { name: /copy share link/i });
  await expect(link.or(dialog)).toBeVisible();
  if (await dialog.isVisible()) await page.keyboard.press("Escape");
  const href = (await link.getAttribute("href")) ?? "";
  expect(href).toContain("/share/profile#");
  expect(href).not.toContain(sessionId);
});
