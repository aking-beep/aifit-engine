import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LEADS_TOKEN } from "../playwright.config";

// Ad landing pages, the ARC call to action, lead capture with campaign
// attribution, and the SEO surfaces, against the real FastAPI backend.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const AUDIENCES = ["professionals", "developers", "creators"];

for (const slug of AUDIENCES) {
  test(`landing page /for/${slug} renders, links to the quiz and ARC, and passes axe`, async ({ page }) => {
    await page.goto(`/for/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('a[href="/assessment"]').first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Book an assessment call" })).toHaveAttribute("href", /calendly\.com.*utm_source=ai-fit/);
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("a lead keeps its campaign and reaches the operator export", async ({ page, request }) => {
  await page.goto("/for/developers?utm_source=google&utm_medium=cpc&utm_campaign=dev-q4");
  await expect(page.getByRole("link", { name: "Book an assessment call" })).toHaveAttribute("href", /utm_campaign=dev-q4/);
  const email = `consumer-lead-${Date.now()}@example.com`;
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("What are you trying to decide? (optional)").fill("Which coding agent for a team of four");
  await page.getByRole("checkbox", { name: /may email me/ }).check();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks, we have it.")).toBeVisible();
  expect((await request.get("/v1/leads")).status()).toBe(401);
  const rows = (await (await request.get("/v1/leads", { headers: { authorization: `Bearer ${LEADS_TOKEN}` } })).json()).leads;
  const lead = rows.find((l: { email: string }) => l.email === email);
  expect(lead.source).toMatchObject({ app: "ai-fit", page: "for/developers" });
  expect(lead.source.attribution.utm).toMatchObject({ utm_source: "google", utm_campaign: "dev-q4" });
});

test("results, the task check and the landing page point to ARC", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choosing AI for a team or a business?" })).toBeVisible();
  await page.getByRole("button", { name: /see an example/i }).click();
  await expect(page.getByText(/Fit score/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Setting up AI for a team, not just yourself?" })).toBeVisible();
  await page.goto("/check");
  await page.getByLabel("Writing or drafting").check();
  await page.getByRole("button", { name: /check this task/i }).click();
  await expect(page.getByRole("heading", { name: "Is this a business decision?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cookie consent" })).toHaveCount(0);
});

test("SEO surfaces, legal pages and the reset page", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const slug of AUDIENCES) expect(sitemap).toContain(`/for/${slug}`);
  expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \/app/);
  expect((await request.get("/for/developers/opengraph-image-1uizub")).headers()["content-type"]).toContain("image/png");
  for (const path of ["/terms", "/refunds"]) {
    await page.goto(path);
    await expect(page.getByRole("note")).toContainText("Draft for review by counsel");
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`), path).toEqual([]);
  }
  await page.goto("/signin");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  // /signin also has an Email field. Wait until that page is gone so fill
  // cannot land on the sign-in form and leave the reset button disabled.
  await expect(page).toHaveURL(/\/reset/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill("someone@example.com");
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/not set up on this deployment/)).toBeVisible();
});
