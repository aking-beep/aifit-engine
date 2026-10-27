import { expect, test } from "@playwright/test";

// The downloaded setup bundle is the validated one: it carries a manifest that
// lists the checks that actually ran.

test("the setup bundle download includes a validated manifest", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /see an example/i }).click();
  await expect(page.getByText(/Fit score/i)).toBeVisible({ timeout: 20_000 });
  const sessionId = page.url().split("/results/")[1]!;
  const stored = await page.evaluate((id) => window.localStorage.getItem(`aifit:result:${id}`), sessionId);
  const result = JSON.parse(stored!);
  const res = await request.post("/v1/export/pack", { data: { persona: result.persona, result } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.filename).toBe("ai-profile.zip");
  expect(body.manifest.validation.status).toBe("format_checks_passed");
  const paths = body.manifest.files.map((f: { path: string }) => f.path);
  expect(paths).toEqual(expect.arrayContaining(["README.md", "CLAUDE.md", ".cursor/rules/fit.mdc", "prompts/draft.md"]));
});
