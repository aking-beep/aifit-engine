import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The signed-in Consumer workspace end to end, against the real FastAPI
// backend: sign-up, onboarding, a quiz saved to the account and scored on the
// server, every /app screen, a setup package download, and isolation between
// two accounts.

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const PASSWORD = "correct horse battery";

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name (optional)").fill("Robin Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

async function saveSampleQuiz(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /see an example/i }).click();
  await expect(page.getByText(/Fit score/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText("Saved to your account")).toBeVisible();
}

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map(
    (v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`,
  );

test("signed-out visitors are sent to sign in and back", async ({ page }) => {
  await page.goto("/app/tools");
  await expect(page).toHaveURL(/\/signin\?next=%2Fapp%2Ftools/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sign up, onboard, save a quiz and use every screen", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, unique());

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Developer/ }).click();
  await page.getByRole("button", { name: "Start the quiz" }).click();
  await expect(page).toHaveURL(/\/assessment\?save=account/);

  await saveSampleQuiz(page);
  await page.getByRole("link", { name: "Open your dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Robin/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended tools" })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByRole("link", { name: "AI profile" }).click();
  await expect(page.getByRole("heading", { name: "Your AI profile" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /careful checker/i })).toBeVisible();

  await page.getByRole("link", { name: "Recommended tools" }).first().click();
  const saveButtons = page.getByRole("button", { name: "Save", exact: true });
  await saveButtons.first().click();
  await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);

  await page.getByRole("link", { name: "Compare" }).click();
  const options = page.getByRole("checkbox");
  await options.nth(0).check();
  await options.nth(1).check();
  await page.getByRole("button", { name: /^Compare/ }).click();
  await expect(page.getByRole("table", { name: "Tool comparison" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Pricing tier" })).toBeVisible();

  await page.getByRole("link", { name: "Workflows" }).click();
  await expect(page.getByRole("heading", { name: "A simple way to work" })).toBeVisible();

  await page.getByRole("link", { name: "Configurations" }).click();
  await expect(page.getByRole("tablist", { name: "Files" })).toBeVisible({ timeout: 20_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  await expect(page.getByText("Package downloaded", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Assessment history" }).click();
  await expect(page.getByText("Quiz ·")).toBeVisible();

  await page.getByRole("link", { name: "Subscription" }).click();
  await expect(page.getByRole("heading", { name: "Payment history" })).toBeVisible();
  await expect(page.getByText("Billing is off on this deployment")).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByRole("link", { name: "Settings" }).first().click();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  expect((await exported).suggestedFilename()).toBe("aifit-account-export.json");
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/signin/);
});

test("one account never sees another account's data", async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await signUp(alice, unique());
  await saveSampleQuiz(alice);
  const history = await alice.evaluate(() => fetch("/v1/account/history").then((r) => r.json()));
  const entryId = history.items[0].id as string;

  await signUp(bob, unique());
  const bobHistory = await bob.evaluate(() => fetch("/v1/account/history").then((r) => r.json()));
  expect(bobHistory.items).toEqual([]);
  const del = await bob.evaluate(
    (id) => fetch(`/v1/account/history/${id}`, { method: "DELETE", headers: { "X-AIFit-Request": "1" } }).then((r) => r.status),
    entryId,
  );
  expect(del).toBe(404);
  await bob.goto("/app/profile");
  await expect(bob.getByText("No AI profile yet")).toBeVisible();

  // A cross-site style request without the header is refused even with a valid cookie.
  const forged = await alice.evaluate(() => fetch("/v1/account", { method: "DELETE" }).then((r) => r.status));
  expect(forged).toBe(403);
  const still = await alice.evaluate(() => fetch("/v1/account/history").then((r) => r.json()));
  expect(still.items[0].id).toBe(entryId);
});

test("a task check can be saved and shows up under workflows", async ({ page }) => {
  await signUp(page, unique());
  await page.goto("/check");
  await page.getByLabel("Writing or drafting").check();
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByTestId("decision-result")).toBeVisible();
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText("Saved to your account")).toBeVisible();
  await page.goto("/app/workflows");
  await expect(page.getByRole("heading", { name: "Tasks you checked" })).toBeVisible();
  await expect(page.getByText(/Checked \d{4}-\d{2}-\d{2}/)).toBeVisible();
});
