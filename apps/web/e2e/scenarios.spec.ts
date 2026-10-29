import { expect, test, type Page } from "@playwright/test";

// The AI Fit 2.0 release scenarios that run on the Consumer app (1–3), end to
// end through the real Next app and FastAPI engine. Scenarios 4–6 run on Teams
// (apps/teams/e2e/scenarios.spec.ts).

type Event = { event_type: string; scenario_id?: string; turn_id?: string; strength?: number; evidence?: string };
type Scenario = { id: string; turns: { id: string; choices: { id: string; events: Event[] }[] }[] };

async function signUp(page: Page) {
  const email = `scn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

test("scenario 1 — beginner: onboarding, recommendations, a usable starter config download", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Professional/ }).click();
  await page.getByRole("button", { name: "Start the quiz" }).click();
  // The quiz itself, answered in the browser.
  await page.getByRole("button", { name: /let's go/i }).click();
  // Each tap answers and advances; between scenes the next one loads on its own.
  for (let i = 0; i < 60 && !/\/results\//.test(page.url()); i++) {
    const choice = page.getByRole("radio").first();
    if (await choice.isVisible().catch(() => false)) await choice.click().catch(() => null);
    await page.waitForTimeout(400);
  }
  await expect(page).toHaveURL(/\/results\/.+\?save=account/, { timeout: 30_000 });
  await expect(page.getByText("Saved to your account")).toBeVisible({ timeout: 20_000 });

  await page.goto("/app/tools");
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await page.goto("/app/configure");
  await expect(page.getByRole("tablist", { name: "Files" })).toBeVisible({ timeout: 20_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.zip$/);
  const res = await page.evaluate(() => fetch("/v1/account/billing").then((r) => r.json()));
  expect(res.usage.config_packages_this_month).toBe(1);
});

test("scenario 2 — developer: coding tools recommended and every config file validates", async ({ page }) => {
  await signUp(page);
  // A developer's answers: every quiz choice that asks for code, exactly as the quiz emits them.
  const scenarios = (await (await page.request.get("/v1/scenarios")).json()) as Scenario[];
  const events: Event[] = [];
  for (const s of scenarios)
    for (const t of s.turns)
      for (const c of t.choices)
        if (c.events.some((e) => e.event_type === "requested_code")) events.push(...c.events.map((e) => ({ ...e, scenario_id: s.id, turn_id: t.id })));
  expect(events.length).toBeGreaterThan(5);
  const saved = await page.evaluate(
    (ev) => fetch("/v1/account/assessments", { method: "POST", headers: { "Content-Type": "application/json", "X-AIFit-Request": "1" }, body: JSON.stringify({ kind: "quiz", events: ev }) }).then((r) => r.json()),
    events,
  );
  const stack = (saved.result.primary_stack.slots as { category: string; recommendation: { name: string } }[]).map((s) => s.category);
  expect(stack.some((c) => c === "ide" || c === "coding_agent")).toBe(true);

  await page.goto("/app/profile");
  await expect(page.getByText("Cursor").first()).toBeVisible();

  // Each per-app file is validated on the server (422 on failure); then the ZIP manifest reports every file checked.
  for (const target of ["cursor", "agents", "claude"]) {
    const r = await page.request.post(`/v1/export/${target}`, { data: { persona: saved.result.persona, result: saved.result } });
    expect(r.status(), target).toBe(200);
    expect((await r.json()).secretsRedacted).toBe(0);
  }
  const pkg = await page.evaluate(() => fetch("/v1/account/package", { method: "POST", headers: { "X-AIFit-Request": "1" } }).then((r) => r.json()));
  const paths = (pkg.manifest.files as { path: string }[]).map((f) => f.path);
  expect(paths.some((p) => p.includes(".cursor"))).toBe(true);
  expect(paths).toContain("AGENTS.md");
  // The bundle is refused (422) if any check fails, so a manifest means every file passed its checks.
  expect(pkg.manifest.validation.status).toBe("format_checks_passed");
  for (const f of pkg.manifest.files as { path: string; checks: string[] }[]) expect(f.checks, f.path).toContain("no_secrets");
});

test("scenario 3 — business workload with no AI need: conventional automation is recommended", async ({ page }) => {
  await signUp(page);
  await page.goto("/check");
  await page.getByLabel("Moving information between apps").check();
  await page.getByLabel("Totals and arithmetic").check();
  await page.getByLabel("Times a month").fill("80");
  await page.getByLabel("Minutes each time").fill("6");
  await page.getByLabel(/one exact right answer/i).check();
  await page.getByRole("button", { name: /check this task/i }).click();
  const heading = page.getByTestId("decision-result").getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(/Rules-based automation|Ordinary software/);
  await expect(page.getByTestId("tool-comparison")).toHaveCount(0);
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText("Saved to your account")).toBeVisible();
  await page.goto("/app/workflows");
  await expect(page.getByText(/Rules-based automation|Ordinary software/).first()).toBeVisible();
});
