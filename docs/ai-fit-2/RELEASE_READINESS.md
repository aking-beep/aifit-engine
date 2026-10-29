# AI Fit 2.0 — full integration: release-readiness report

Branch `feature/ai-fit-2-commercial-platform` (mirror `ccr-b8fdb0c7-3d2dax`), PR #30. Assessed on
2026-10-29 at commit `c0c5a98`. Builds on [RELEASE.md](./RELEASE.md) (platform, engines, agents) and
[INTEGRATION.md](./INTEGRATION.md) (Magic Patterns inspection and screen matrix).

## Recommendation

**Ready for internal testing now. Ready for a private beta once the owner connects Upstash and Stripe
test keys to both preview projects and runs one real test-card purchase. Not ready for a paid pilot
or a public commercial release.** The blockers are listed below. None of them can be fixed in code
from this session: they need owner accounts, owner decisions, or a dependency upgrade done as its own
change.

## Product status

| Area | Consumer (`apps/web` + `services/api`) | Teams (`apps/teams`) |
|---|---|---|
| Design system | Shared tokens and components (`packages/design`, vendored and checked in CI) | Same |
| Screens | Landing, sign up/in, onboarding, quiz, results, task check, and `/app`: dashboard, profile, tools, compare, workflows, configure, saved, history, upgrade, subscription, settings | Landing, intake, report (13 sections), workspace dashboard, portfolio, history, admin, billing, settings, onboarding |
| Data | Saved results are re-scored on the server from the answers | Saved assessments are recomputed from the workload on each view |
| Auth | scrypt passwords, hashed HttpOnly session cookie, CSRF header plus Origin check, lockout after 10 failures | Same rules (TypeScript platform package) |
| Isolation | Per account; tested in pytest and the browser | Per organisation, with roles; tested in the browser |
| Downloads | Setup package ZIP (validated, secret-scanned, manifest) and account data export | Blueprint (MD, JSON) and governance export |
| Billing | Pro subscription; free limits enforced on the server; Stripe Checkout and portal; webhooks | Assessment, blueprint and workspace plan; webhooks |
| Live billing | Refused without `sk_live_` **and** `BILLING_ALLOW_LIVE=1` | Same |

Not shown as fact anywhere: tool prices (registry tiers only), measured performance, evaluation
results, certifications. Evaluation and setup checks are labelled "Not tested". Governance output is
labelled "Recommended, not enforced".

## Test evidence

Every row was executed in this session on `c0c5a98` or the commit just before it. Nothing here was
fixed by skipping, quarantining or loosening a test.

| Check | Result | Detail |
|---|---|---|
| Python lint (`ruff check packages services tests evals`) | PASS | 0 findings |
| Python unit and API tests (`pytest`) | PASS | 159 passed (21 new for accounts and billing) |
| Evals (`validate-seed`, `run-cases`) | PASS | 3 cases |
| Design copies in sync (`sync-design.mjs --check`) | PASS | |
| TypeScript unit tests (`npm run test:teams`, 9 packages) | PASS | 373 passed, 0 failed |
| Teams typecheck | PASS | |
| Teams production build | PASS | |
| Teams browser tests (Playwright, 3 servers) | PASS | 38 passed |
| Consumer lint and typecheck | PASS | |
| Consumer production build | PASS | 24 routes |
| Consumer browser tests (Playwright) | PASS | 39 passed: 32 existing, 4 account, 3 scenario |
| Consumer billing browser tests (Stripe test-mode configuration) | PASS | 5 passed |
| Accessibility (axe, WCAG 2.1 A/AA) | PASS | Consumer public pages, light and dark; every `/app` screen visited in `account.spec`; every Teams section and the workspace. Automated checks only; no screen-reader or keyboard-only audit was run |
| Auth | PASS | Sign-up, sign-in, sign-out, wrong password, duplicate email, lockout, forged cookie, expired session |
| Authorization and isolation | PASS | Consumer: account B cannot read or delete A's history, profile or saved items. Teams: org B gets 404 on A's report, record, blueprint (JSON, MD), governance export, risks (GET and PATCH), and the reverse |
| Payment and webhook idempotency | PASS | Duplicate event answers `duplicate` and records one payment; concurrent delivery is locked; replayed old signature, wrong secret, missing header and live-mode event on a test deployment are all refused |
| Billing lifecycle | PASS | Paid, async success and failure, unpaid completion, expired checkout, canceled checkout, past due then recovered, cancel at period end, deletion, full refund (revokes), partial refund (does not), expiry after the grace period |
| API security probe (live server) | PASS | 413 on an oversized body; 403 without the CSRF header and with a foreign Origin; HttpOnly + SameSite=Lax cookie (Secure on HTTPS); CORS gives `*` with no credentials; 401 on a forged cookie; 503 on the webhook with billing off; no tracebacks in error bodies |
| Python dependency audit (`pip-audit`) | PASS | No known vulnerabilities in the deployed requirements or the dev environment |
| npm audit, Consumer | PASS with notes | One high (systeminformation, via the shadcn CLI) fixed without breaking changes. 3 low remain (deepmerge via the shadcn CLI, a build-time tool) |
| npm audit, Teams workspace | **FAIL** | 2 high, 1 moderate: PostCSS bundled in Next 15 (build-time CSS processing), and zod 3 (memory exhaustion on oversized constrained collections). Both fixes are major upgrades (Next 16, zod 4) |
| Deployment smoke tests | PASS (GET only) | See below |
| Real Stripe test-mode payment | **NOT TESTED** | No Stripe keys on either project. Webhooks were signed locally exactly as Stripe signs them |
| Accounts and workspaces on the previews | **NOT TESTED** | No durable store on either project, so both correctly answer "unavailable" |
| Load, soak and failover | NOT TESTED | |
| Penetration test, manual accessibility audit | NOT TESTED | |

### The six release scenarios

| # | Scenario | Where | Result |
|---|---|---|---|
| 1 | Consumer beginner: onboarding, recommendations, usable starter config download | `apps/web/e2e/scenarios.spec.ts` (real browser quiz) and `account.spec.ts` | PASS |
| 2 | Developer: coding tools recommended, valid config files | `apps/web/e2e/scenarios.spec.ts`. Cursor and Claude Code are in the stack; the cursor, agents and claude files and the ZIP pass server validation | PASS |
| 3 | Business workload with no AI need: conventional automation | `apps/web/e2e/scenarios.spec.ts`. Rules-based automation or ordinary software; no tool comparison is shown | PASS |
| 4 | Enterprise AI workload: architecture, technology, cost, governance, evaluation plan, roadmap | `apps/teams/e2e/scenarios.spec.ts` plus every section in `screens.spec.ts`; blueprint MD has each section | PASS |
| 5 | Paid assessment: test payment, entitlement granted, blueprint downloaded | `apps/teams/e2e/billing-scenario.spec.ts`. Locked (402) before payment; a signed test-mode webhook grants it; the browser downloads the blueprint; payment history shows $999.00 | PASS (simulated Stripe) |
| 6 | Two organisations, no cross-access | `apps/teams/e2e/scenarios.spec.ts`, `workspace.spec.ts`; Consumer equivalent in `account.spec.ts` | PASS |

## Deployments (Vercel previews, not production)

| Project | Branch preview | State at `c0c5a98` |
|---|---|---|
| Consumer `aifit-engine` | `aifit-engine-git-feature-ai-e0c8b2-andrew12king-7660s-projects.vercel.app` | READY |
| Teams `ark-ai-fit-teams` | `ark-ai-fit-teams-git-feature-fd2aa9-andrew12king-7660s-projects.vercel.app` | READY |

The Teams deployment problem is resolved. Builds had failed because the project's Root Directory
pointed at `apps/business`. Since that was corrected, every commit on this branch has built.

Smoke-tested on the previews (GET only; this environment cannot POST to `*.vercel.app`):
- Consumer: `/health` → 200, `store: filesystem, durable: false`. `/signin` → 200, the new design.
  `/v1/account/status` → accounts off with the Upstash reason, billing off. `/v1/account/me` → 503
  with the same reason.
- Teams: `/signin` → 200 in the new design, showing "Workspaces are switched off on this deployment"
  with the Upstash reason. Responses carry the security headers (CSP frame-ancestors, X-Frame-Options
  DENY, nosniff, Permissions-Policy, HSTS).

Environment variables found on the projects (names only):
- Consumer: none.
- Teams: `ARK_CONTROL_URL`, `ARK_CONTROL_TOKEN`.
- Neither has Upstash or Stripe variables, so logins, workspaces and payments cannot be exercised
  on the previews yet.

Monitoring: Vercel runtime logs. The API logs only event names and hashes, never answers.
Rollback: redeploy the previous deployment in Vercel. With billing off there is nothing to unwind.
No data migrations: new account data lives under new `acct_` keys.

### To make logins and payments testable on the previews (owner actions)

1. Add an Upstash Redis database to both projects (Vercel Marketplace → Upstash), or set
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on each. Redeploy.
2. Stripe **test** account:
   - Consumer: one monthly price → `STRIPE_PRICE_PRO`.
   - Teams: `STRIPE_PRICE_ASSESSMENT`, `STRIPE_PRICE_BLUEPRINT`, `STRIPE_PRICE_TEAM_MONTHLY`.
   - On both: `BILLING_MODE=test`, `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET`, and
     `APP_URL` set to the preview host.
3. Webhook endpoints, with the event lists in each `.env.example`:
   - Consumer: `<consumer host>/v1/billing/webhook`
   - Teams: `<teams host>/api/billing/webhook`
4. For Consumer cancellation, save the Customer Portal settings once in Stripe's test dashboard.
5. Preview deployments use Vercel Authentication. Testers need access to the Vercel team, or a
   protection bypass or share link.

## Commercial readiness

| Stage | Ready? | What is missing |
|---|---|---|
| Internal testing | **Yes** for anonymous flows on the previews, and for every flow locally (`npm run dev` plus uvicorn) | Upstash on the previews for accounts |
| Private beta | **Not yet** | Upstash on both projects; Stripe test keys and one real test-card run of each product; password reset; the Teams dependency upgrades |
| Paid pilot | **No** | Everything above, plus: live Stripe keys and `BILLING_ALLOW_LIVE=1` (owner approval required); terms of service, privacy policy and refund policy reviewed by counsel; prices confirmed; transactional email (receipts, password reset, invites); support channel; error alerting |
| Public commercial release | **No** | Everything above, plus: security review or penetration test; manual accessibility audit; load test; MFA, and SSO for Teams; tax handling; data-processing agreement; incident runbook; recommendation weights validated against outcomes |

## Outstanding work

**Critical blockers (owner):**
- No durable store on either Vercel project, so accounts and workspaces are off there.
- No Stripe test keys on either project, so no real test payment has run.
- Live billing is deliberately not enabled and needs the owner's approval.

**High priority:**
- Teams dependency upgrades: zod 3 → 4 (DoS advisory) and Next 15 → 16 (bundled PostCSS advisories).
  Do these as their own PR with the full Teams suite.
- Password reset and transactional email, on both products.
- The Teams model catalog prices are dated 2026-09-14 and were due for re-verification by today,
  2026-10-29. The weekly verifier flags stale entries; a person still has to confirm prices.
- Teams has no in-app billing portal. Consumer has one.

**Accepted limitations:**
- Free-plan limits apply only when billing is on. With billing off everything is free.
- An anonymous Consumer setup package (`/v1/export/pack`) is still free and uncounted. The monthly
  limit applies to packages built from an account.
- Tool prices are registry tiers, not amounts.
- Decision weights are published rules of thumb, not fitted to outcomes.

**Follow-ups:**
- An end-to-end check against the real Stripe test API, once keys exist.
- Restyle the remaining original Consumer components (results view, task check form) fully onto
  design-system components. They already use the design tokens.
- MFA, and SSO for Teams.
