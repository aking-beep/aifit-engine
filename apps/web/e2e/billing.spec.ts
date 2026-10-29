import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { WEBHOOK_SECRET } from "../playwright.billing.config";

// Consumer Pro in Stripe test-mode configuration. Stripe itself is not
// reachable from CI, so payment events are signed here with the webhook
// secret exactly as Stripe signs them, and posted to the real endpoint.

const H = { "X-AIFit-Request": "1" };

async function signUp(page: Page) {
  const email = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  return (await page.evaluate(() => fetch("/v1/account/me").then((r) => r.json()))).user.id as string;
}

let n = 0;
async function send(page: Page, type: string, object: Record<string, unknown>, id = `evt_e2e_${Date.now()}_${n++}`) {
  n += 1;
  const body = JSON.stringify({ id, type, created: Math.floor(Date.now() / 1000) + n, livemode: false, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  const res = await page.request.post("/v1/billing/webhook", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as { status: string };
}

async function saveSample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /see an example/i }).click();
  await expect(page.getByText(/Fit score/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText("Saved to your account")).toBeVisible();
}

test("free limits are enforced by the server", async ({ page }) => {
  await signUp(page);
  await saveSample(page);
  const profile = await page.evaluate(() => fetch("/v1/account/profile").then((r) => r.json()));
  expect(profile.entry.result.products.length).toBeLessThanOrEqual(3);
  await page.goto("/app/tools");
  await expect(page.getByText(/more matches are available on Pro/)).toBeVisible();
  const statuses = await page.evaluate(async (h) => {
    const a = await fetch("/v1/account/package", { method: "POST", headers: h });
    const b = await fetch("/v1/account/package", { method: "POST", headers: h });
    return [a.status, b.status];
  }, H);
  expect(statuses).toEqual([200, 402]);
  await page.goto("/app/configure");
  await expect(page.getByText("Free plan: 1 of 1 setup package this month.")).toBeVisible();
});

test("checkout that Stripe refuses grants nothing and says so", async ({ page }) => {
  await signUp(page);
  await page.goto("/app/upgrade");
  await expect(page.getByText("Stripe test mode").first()).toBeVisible();
  await page.getByRole("button", { name: "Upgrade to Pro" }).click();
  await expect(page.getByText("Checkout did not start")).toBeVisible();
  await page.goto("/app/subscription");
  await expect(page.getByText("You’re on the Free plan")).toBeVisible();
});

test("paid, duplicate, past due, recovered, cancel at period end, refund", async ({ page }) => {
  const uid = await signUp(page);
  const meta = { userId: uid, product: "consumer-pro" };
  const paid = {
    id: `cs_e2e_${uid}`, payment_status: "paid", subscription: `sub_${uid}`, customer: `cus_${uid}`,
    amount_total: 1200, currency: "usd", metadata: meta,
  };
  const sub = { metadata: { userId: uid } };

  const evt = `evt_e2e_dup_${uid}`;
  expect((await send(page, "checkout.session.completed", paid, evt)).status).toBe("processed");
  expect((await send(page, "checkout.session.completed", paid, evt)).status).toBe("duplicate");
  await page.goto(`/app/subscription?status=success&session_id=${paid.id}`);
  await expect(page.getByText("Payment confirmed")).toBeVisible();
  await expect(page.getByText("Pro is active")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$12", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /^Upgrade/ })).toHaveCount(0);

  await send(page, "invoice.payment_failed", { id: `in_f_${uid}`, customer: `cus_${uid}`, amount_due: 1200, currency: "usd", subscription_details: sub });
  await page.goto("/app/subscription");
  await expect(page.getByText("Payment failed").first()).toBeVisible();

  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  await send(page, "invoice.paid", { id: `in_ok_${uid}`, customer: `cus_${uid}`, amount_paid: 1200, currency: "usd", period_end: periodEnd, subscription_details: sub });
  await send(page, "customer.subscription.updated", {
    id: `sub_${uid}`, customer: `cus_${uid}`, status: "active", cancel_at_period_end: true, current_period_end: periodEnd, metadata: { userId: uid },
  });
  await page.goto("/app/subscription");
  await expect(page.getByText("Pro ends at the end of this period")).toBeVisible();

  await send(page, "charge.refunded", { id: `ch_${uid}`, customer: `cus_${uid}`, refunded: true, amount_refunded: 1200, currency: "usd" });
  await page.goto("/app/subscription");
  await expect(page.getByText("Payment refunded").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "See Pro" })).toBeVisible();
});

test("abandoned and failed checkouts are recorded without granting Pro", async ({ page }) => {
  const uid = await signUp(page);
  const meta = { userId: uid, product: "consumer-pro" };
  await send(page, "checkout.session.expired", { id: `cs_exp_${uid}`, amount_total: 1200, currency: "usd", metadata: meta });
  await send(page, "checkout.session.async_payment_failed", { id: `cs_fail_${uid}`, amount_total: 1200, currency: "usd", metadata: meta });
  await page.goto("/app/subscription");
  await expect(page.getByText("You’re on the Free plan")).toBeVisible();
  await expect(page.getByRole("cell", { name: "expired" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "failed" })).toBeVisible();
});

test("forged and unsigned webhooks are rejected", async ({ page }) => {
  const body = JSON.stringify({ id: "evt_forged", type: "checkout.session.completed", created: 1, livemode: false, data: { object: {} } });
  const headers = { "content-type": "application/json" };
  const unsigned = await page.request.post("/v1/billing/webhook", { data: body, headers });
  const forged = await page.request.post("/v1/billing/webhook", {
    data: body,
    headers: { ...headers, "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
  });
  expect([unsigned.status(), forged.status()]).toEqual([400, 400]);
});
