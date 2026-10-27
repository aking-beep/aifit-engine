# AI Fit 2.0 — release report

Branch `ccr-b8fdb0c7-3d2dax` (mirrored to `feature/ai-fit-2-commercial-platform`), 2026-10-27.
Every result below was produced in this session; nothing is projected.

## Release recommendation

**Ready for a staging review. Not ready for production or for taking money.**

- Both apps build, deploy as Vercel previews, and pass their full automated suites.
- Anonymous flows (Consumer quiz + task check; Teams intake + report + blueprint) work on the previews.
- **Teams workspaces are switched off on the preview** because the `ark-ai-fit-teams` project has no
  durable store. They work end to end locally and in CI against a file store. Attach Upstash/Vercel KV
  before calling staging complete (see Blockers).
- **Billing has never talked to Stripe.** It is fully exercised with fake keys and locally signed
  webhooks; it needs a real Stripe test-mode account to be verified (see Payment readiness).

## What was implemented

### Shared decision intelligence
- `@aifit/decision-core` (TypeScript) and `aifit.decision` (Python): five outcomes — no change,
  conventional software, conventional automation, buy AI, build AI — from structured inputs (goal,
  work types, frequency, time, role, technical ability, org/team, data classes, regulation, residency,
  local-only, budgets, timeline, integrations, autonomy, irreversible actions, hosted-tools policy).
- Deterministic hard constraints (`HC_*`, ten rules) that can exclude outcomes, restrict tools, or
  require controls. AI suitability score with six weighted dimensions and reasons. Per-factor
  contributions for every outcome. Risk and feasibility. Missing and contradictory inputs.
  "What would change the answer". Assumptions, limitations, `validation.status = not_validated`.
- Cost lines that name their basis: user-supplied time and value, rule-of-thumb effort ranges, and
  (Teams) model run cost from the dated catalog. **No tool price is ever invented**; subscription
  prices print as "not recorded in the registry".
- Reproducibility: engine version, rules version and a SHA-256 input hash on every result; the hash is
  byte-identical across the two languages.
- Every weight lives in `packages/decision-core/rules/decision-rules.v1.json`, published at
  `GET /v1/decision/rules`.
- Free text is hashed but never scored; unknown keys are dropped. An optional model-written
  explanation adapter is schema-validated and discarded if it names another outcome (off; no model is
  called anywhere by default).

### Consumer (Fit)
- `/check` task check with all five options compared, rules that applied, time/cost table, risk and
  feasibility, and a comparison of registry tools passing the person's constraints (local-only, free
  tier), each with evidence link and last-checked date.
- Setup bundle now includes five prompt templates, a workflow template and a setup README; every
  file is credential-redacted and format-validated, with a manifest of the checks that ran.
- `/history` (browser-only), anonymous allow-listed activation counters (`POST /v1/activation`),
  privacy page updated. Existing feedback endpoint unchanged.

### Teams
- Report gains "Build, buy, or automate?" (with an explicit warning when it disagrees with the
  suitability verdict), save and download actions. The anonymous report is unchanged and free.
- Accounts, org workspaces, owner/admin/member/viewer roles, email-bound invite links, audit log.
- Saved, versioned assessments with engine snapshots; reassessment creates the next version.
- Technical blueprint (Markdown and JSON, schema-validated, secret-checked); PDF via the report's print
  stylesheet (no server-side PDF — not reliable on serverless, so not attempted).
- Intake asks for budgets, timeline and whether hosted tools are acceptable (optional).
- Account export and deletion with sole-owner and active-subscription guards; privacy page.

### ARC Control interoperability
- `@aifit/control-export-contract`: GovernanceExport v1 (zod + JSON Schema + `CONTRACT.md` + fixture),
  marked **proposed**. Governance requirements, policy suggestions, agent inventory requirements and
  the evaluation plan. `enforcement` is the literal `recommended-not-enforced`; `observed` evaluation
  results are always empty; verification owner is always `customer`.
- Delivery: file download (default); HTTP adapter behind `CONTROL_EXPORT_URL` (off; reports any
  non-2xx as "not delivered"). No Control endpoint is assumed to exist.

### Commercial
- `BILLING_MODE=off|test|live`; live needs an `sk_live_` key and `BILLING_ALLOW_LIVE=1`; a live key in
  test mode is refused. Stripe-hosted Checkout (one-time blueprint per assessment; team subscription).
- Server-side entitlement checks on every paid route; entitlements written only by verified webhooks.
- Webhook: HMAC-SHA256 signature over the raw body, 5-minute tolerance, multiple `v1` signatures,
  idempotent per event id with a processing lock, safe retry on failure, live-mode events ignored on
  test deployments. Handles completed, async succeeded/failed, expired, subscription updated/deleted,
  invoice payment failed. Return page polls for webhook-confirmed status.

## Test evidence

| Suite | Before | After | Result |
|---|---:|---:|---|
| Python (`pytest`) | 35 | 112 | all pass |
| Python lint (`ruff`) | — | — | clean |
| Registry seed + eval cases | 3 cases | 3 cases | pass |
| TypeScript unit (8 packages + Teams app) | 141 | 312 | all pass |
| Teams typecheck / build | — | — | pass |
| Consumer lint / `tsc` / build | — | — | pass |
| Consumer browser (Playwright) | 12 | 30 | all pass |
| Teams browser (Playwright) | 0 | 22 | all pass |

Coverage of the mission's list:

| Required | Where |
|---|---|
| Consumer assessment completion | `apps/web/e2e/*` (existing), `task-check.spec.ts` |
| Teams assessment completion | `apps/teams/e2e/assessment.spec.ts` (full 8-step intake in the browser) |
| Every outcome incl. no-AI | 15 shared fixtures (`packages/decision-core/fixtures`), both languages |
| Missing / contradictory inputs | fixtures `consumer-missing-inputs`, `consumer-contradictory`; e2e |
| Cost estimation | `engine.test.ts` costs, `deliverables.test.ts` basis checks |
| Recommendation schema validation | decision input validation (both languages), `BlueprintSchema`, GovernanceExport |
| Artifact generation | `tests/test_bundle.py`, `deliverables.test.ts`, e2e downloads |
| Authentication / authorization | `auth.test.ts`, `orgs.test.ts`, `workspace.spec.ts` |
| Cross-organisation isolation | `isolation.test.ts`, `workspace.spec.ts` (404 across orgs) |
| Payment + webhook idempotency | `billing.test.ts`, `billing.spec.ts` (forged, stale, replayed, live-mode) |
| Browser workflows | 52 Playwright tests across both apps |
| Accessibility | axe WCAG 2.1 A/AA on 12 Consumer views (light + dark) and 11 Teams views |
| Deployment builds | Local builds, CI jobs, and Vercel previews (below) |
| ≥10 workloads / regression fixtures | 15 decision fixtures + `golden.json`, 3 Teams fixtures |
| Prompt injection | `injection.test.ts`, `test_decision.py`, `explain.test.ts` |

Accessibility: axe found real, pre-existing failures that are now fixed — Consumer primary colour at
4.4:1 and destructive at 3.9:1, unnamed progress bars; Teams intake step list dimmed below 4.5:1.
Automated checks are not a full audit; no screen-reader or keyboard-only session was run.

## Deployments

| Project | What happened | Evidence |
|---|---|---|
| `ark-ai-fit-teams` | Was failing every build since the repo move: Root Directory still `apps/business`. Set to `apps/teams`. | First READY build since the move: `dpl_C7zJUmTdu8ZUqMsfd91gPBmVKsE4`; every later commit READY |
| `aifit-engine` | Builds unchanged in shape (Vercel Services). | READY on every commit |

Checked on the previews (GET only — this environment cannot send POSTs to `*.vercel.app`):
Teams `/api/blueprint` returned a full Markdown blueprint; `/signin` shows "Workspaces are switched off
on this deployment" with the operator reason; Consumer `/v1/decision/rules` returns the rules (so the
Python function bundles `packages/decision-core/rules`); `/health` reports `store: filesystem,
durable: false`. POST flows (task check, sign-up, save, webhooks) are verified locally and in CI, not
on the previews.

## Environment variables

Consumer (`aifit-engine`): unchanged — `UPSTASH_REDIS_REST_URL`/`TOKEN` (or `KV_REST_API_*`) for
durable shares and activation counters; optional `AIFIT_LLM_CLASSIFIER*`.

Teams (`ark-ai-fit-teams`), all optional; see `apps/teams/.env.example`:

| Variable | Needed for |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Workspaces on Vercel (otherwise off) |
| `BILLING_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BLUEPRINT`, `STRIPE_PRICE_TEAM_MONTHLY`, `APP_URL` | Billing (off when unset) |
| `BILLING_ALLOW_LIVE=1` | Live charges (never set by default) |
| `CONTROL_EXPORT_URL`, `CONTROL_EXPORT_TOKEN` | Optional HTTP delivery of the governance export |
| `ARK_CONTROL_URL`, `ARK_CONTROL_TOKEN` | Existing calibration read from ARC Control (already set on the project; names kept for compatibility) |

## Migration and rollback

- **Data:** no migrations. Teams previously stored nothing; the new store is additive and namespaced
  (`aifit-teams:` prefix in Upstash). Old report links decode unchanged (`planning` defaults to `{}`;
  covered by a test). Consumer storage keys are unchanged; history is a new index key.
- **Rollback:** redeploy the previous production deployment in Vercel (instant), or revert the merge.
  With billing off there is nothing to unwind. If billing was enabled, disable `BILLING_MODE` first so
  no new checkouts start; existing Stripe subscriptions must be managed in Stripe.
- **Vercel setting:** the Root Directory change on `ark-ai-fit-teams` is required for any commit of
  this repo to build there; reverting it breaks builds again.

## Payment readiness

Code-complete and unit/browser-tested **without Stripe**. Before taking test payments:
1. Create a Stripe test account, two prices (one-time blueprint, monthly team), and a webhook endpoint
   for `https://<teams-host>/api/billing/webhook` with the events listed in `.env.example`.
2. Set the billing variables with `BILLING_MODE=test`, and a durable store.
3. Run one real test-card purchase of each product, one failed card (`4000 0000 0000 0341`), one
   cancelled checkout, and `stripe trigger` replays; confirm entitlements in the workspace.
4. Decide prices and refund policy; neither is set in code.

Not implemented: customer portal (card updates and cancellation happen in the Stripe dashboard),
proration, tax, invoices/receipts in-app, dunning emails.

## Known limitations

- No email: invites are links the admin copies; no password reset (an admin cannot reset either).
- No SSO/SAML, no MFA.
- Rate limits are per store window; without Upstash (local only) they are per process.
- Layout reads the session on every Teams page: several store round-trips per request.
- Tool prices are not in the registry, so cost comparison for "buy" is tier-level only.
- Teams model catalog prices are dated 2026-09-14 and need re-verification by 2026-10-29.
- Decision weights are rules of thumb, not fitted to outcomes; nothing is validated against results.
- Consumer history and task checks live only in the browser (by design: Fit has no accounts).
- The optional model explainer exists but is not wired into either UI.
- Activation counters on the Consumer preview are not durable (no Upstash on that project).

## Outstanding security risks

| Risk | Severity | Note |
|---|---|---|
| `zod@3` memory-exhaustion advisory | Medium | Mitigated by body and array caps; fix is zod 4 |
| Next 15 bundled PostCSS advisory | Low | Build-time only, own CSS; overridden to ^8.5.31 |
| No CSP `script-src` on Teams | Medium | `frame-ancestors` etc. set; a full CSP needs Next nonce wiring |
| No MFA / password reset | Medium | Account recovery requires operator action |
| Login lockout by email (10/15 min) | Low | Can be used to slow a known user's sign-in |
| Consumer API CORS `*` | Low | Pre-existing; session calls need a token |
| Secret patterns are heuristic | Low | Redaction/refusal catches common key shapes, not all secrets |

No live keys, tokens or secrets are committed; the e2e Stripe values are obviously fake and are refused
by Stripe.
