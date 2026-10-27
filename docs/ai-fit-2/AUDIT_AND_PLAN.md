# AI Fit 2.0 — Phase 0 audit and architecture plan

Audited 2026-10-27 against `main` @ `1aa8e2e`. Every "passes" below was run in this
session; nothing here is inferred from file names alone.

## 1. What is in the repository

| Surface | Path | Stack | Deploys as |
|---|---|---|---|
| **AI Fit Consumer** ("Fit") | `apps/web` + `services/api` + `packages/core` (Python `aifit`) | Next.js 16 / React 19 UI, FastAPI, Pydantic scoring engine | Vercel project `aifit-engine` (Vercel Services: `web` + `api`, root `vercel.json`) |
| **AI Fit Teams** | `apps/teams` + `packages/teams-core`, `packages/ui`, `packages/calibration-contract` | Next.js 15 / React 18, zod, npm workspace at the repo root | Vercel project `ark-ai-fit-teams` (root `apps/teams`, `apps/teams/vercel.json`) |
| Registry | `data/registry/{products,models}.json` | JSON, dated + evidenced | read by the Python engine |
| Evals | `evals/` | Python harness over 3 cases | CI only |

Entry points: Consumer `/` → `/assessment` → `/results/[sessionId]` (+ `/share/[id]`,
`/registry`, `/methodology`, `/privacy`). Teams `/` → `/assess` → `/report?w=…` (+ `/methodology`,
`POST /api/assess`, `POST /api/measure` (always disabled in this build)).

The two products already share a design principle but **no code**: Consumer reasons in Python over a
behavioural quiz; Teams reasons in TypeScript over a structured `Workload`.

## 2. Baseline verification (before any change)

| Check | Command | Result |
|---|---|---|
| Python lint | `ruff check packages services tests evals` | pass |
| Python tests | `pytest` | **35 passed** |
| Registry seed | `python -m evals.harness validate-seed` | pass (16 products, 4 models) |
| Eval cases | `python -m evals.harness run-cases` | 3 passed |
| Teams unit tests | `npm run test:teams` | **141 passed** (12 contract, 71 core, 4 ui, 54 app) |
| Teams typecheck / build | `npm run typecheck:teams`, `npm run build:teams` | pass |
| Consumer lint / tsc / build | `apps/web`: `npm run lint`, `tsc --noEmit`, `npm run build` | pass |
| Consumer browser e2e | `apps/web`: `npx playwright test` | **12 passed** |

## 3. The reported Teams Vercel deployment error — root cause

Vercel project `ark-ai-fit-teams` was created against `aking-beep/ark` with Root Directory
`apps/business`. When Teams moved here (PR #26) the project was relinked to `aking-beep/aifit-engine`
but the Root Directory was not updated. Both builds since the relink (`dpl_GHDb9…`, `dpl_HGX7x…`) fail
at clone time with:

```
The specified Root Directory "apps/business" does not exist. Please update your Project Settings.
```

No application code ran; the code builds locally. **Fix applied in this session:** Root Directory set
to `apps/teams` with "include source files outside the Root Directory" on (the build needs the
workspace packages and the root lockfile), as `apps/teams/README.md` already documents. The next push
produces the first verifiable build.

## 4. Security and reliability findings

| # | Severity | Finding | Action |
|---|---|---|---|
| S1 | **Critical** | `next@15.5.25` (Teams) and `next@16.3.4` (Consumer) carry published critical advisories (RCE in image optimisation / `next/og`, cache poisoning). | Bumped to 15.5.28 / 16.4.3 (same versions as open PR #29). Consumer `npm audit --omit=dev`: 0. |
| S2 | High (build-time) | Next 15 bundles `postcss@8.4.31` (sourceMappingURL file read). Only our own CSS is processed. | npm override to `^8.5.31`; build verified. |
| S3 | High (mitigated) | `zod@3` memory-exhaustion advisory on oversized constrained collections; fix is zod 4 (major). | Mitigated: every route caps body size (256 KB) and array lengths before parsing. zod 4 migration listed as follow-up. |
| S4 | Medium | Consumer FastAPI CORS is `allow_origins=["*"]`. Session calls need the token, so cross-origin reads still need a secret. | Left; documented. |
| S5 | Medium | Consumer analytics are in-process only (lost per instance), so activation cannot be measured on Vercel. | Durable, allow-listed activation counters added (Phase 2). |
| S6 | Medium | Consumer store on Vercel without Upstash/KV writes `/tmp` per instance; share IDs are not durable. The `aifit-engine` Vercel project has **no env vars**. | Pre-existing, documented; needs `UPSTASH_REDIS_REST_*`. |
| S7 | Low | Teams catalog prices are stamped 2026-09-14; `staleEntries()` flags them after 45 days (2026-10-29). | Needs a human price re-verification; not done by code. |
| S8 | Low | Next 16.4 infers the Turbopack root as the repo root when the root workspace is installed, which broke `apps/web` builds locally. | Pinned `turbopack.root` in `apps/web/next.config.ts`. |
| R1 | Info | Teams stores nothing (intake is in the URL). This is a privacy feature, not a bug — and also why history, orgs and billing do not exist yet. | Preserved: the stateless report stays; workspaces are opt-in. |

## 5. Capability matrix (before this branch)

Legend: ✅ implemented · 🟡 partial · ❌ missing · 🔴 broken · ❔ unverified

### Shared decision intelligence
| Capability | Status | Notes |
|---|---|---|
| Goals / workload description | 🟡 | Teams `Workload.name/description`; Consumer quiz is behavioural, not task-based |
| Role, technical ability, org context | 🟡 | Teams `team.*`; Consumer infers code comfort from behaviour |
| Privacy / compliance / data sensitivity | 🟡 | Teams `dataClasses`, `regulated`, `dataResidency`; Consumer `local_only` filter |
| Budget, timeline, infrastructure, integrations | ❌ / 🟡 | Teams `sourceSystems`; no budget or timeline anywhere |
| AI suitability with reasoning | ✅ (Teams) | 7-dimension rubric, weights as data |
| Five outcomes (no change / software / automation / buy / build) | ❌ | Teams has 5 *verdicts* (not-ai … automate), not build-vs-buy |
| Explainable tool + model recommendations | ✅ | Consumer products+models with evidence; Teams model routing |
| Cost assumptions, ranges, uncertainty | 🟡 | Teams: per-unit/month with basis tags; Consumer: pricing tier only (no prices recorded) |
| Risk and feasibility | 🟡 | Teams security rubric; no feasibility analysis |
| Versioning / reproducibility | 🟡 | Rubric "v0.1" string; no engine version or input hash on results |

### Consumer
| Capability | Status |
|---|---|
| Onboarding, accessible chrome (skip link, reading levels, theme) | ✅ |
| ~5-minute adaptive assessment | ✅ |
| Explainable tool matching | ✅ |
| Tool comparison + cost estimates | 🟡 tiers only |
| Starter configurations (CLAUDE.md, AGENTS.md, Cursor, ChatGPT, Gemini) | ✅ |
| Prompt and workflow templates | 🟡 one primed message |
| Setup instructions | 🟡 deep links only |
| Downloadable bundle | ✅ zip, ❌ not validated, ❌ no secret scan, ❌ no manifest |
| Assessment history | ❌ (single result per session in localStorage) |
| Feedback | ✅ `/v1/feedback` · Activation tracking ❌ |

### Teams
| Capability | Status |
|---|---|
| Workload intake (8 sections) with early provisional verdict | ✅ |
| Build-vs-buy-vs-automate comparison | ❌ |
| Architecture, model, cost, security, evaluation plan, roadmap | ✅ |
| Downloadable blueprint (JSON/Markdown) | ❌ (print stylesheet only) |
| History / reassessment | ❌ |
| Accounts, orgs, isolation, roles | ❌ |
| Payments | ❌ |
| Control interop | 🟡 one inbound calibration read; no export |

## 6. Architecture decisions

**ADR-1 · Shared intelligence is a contract + rules + fixtures, implemented natively per stack.**
Consumer scoring is Python and Teams is TypeScript; each deploys separately. Rather than make one app
call the other (coupling releases) or rewrite one (destroying a working product), the new five-outcome
decision engine is specified once — `packages/decision-core/rules/decision-rules.v1.json` (every weight
and threshold), a JSON contract, and shared fixtures — and implemented in TypeScript
(`@aifit/decision-core`) and Python (`aifit.decision`). Both suites run the same fixtures and must agree
on outcome *and* scores. Drift fails CI.

**ADR-2 · Deterministic authority; free text is display-only.** Hard constraints, outcome selection,
entitlements and security controls read only structured fields. Free text (goal, description) is never
an input to scoring, so prompt injection cannot move a decision. An optional LLM explainer may rephrase
the explanation; its output is schema-validated, cannot carry an outcome, and is discarded on any
mismatch.

**ADR-3 · No invented facts.** Tool prices are shown only where the registry records them with
evidence (today: none, so tiers + "check vendor"). Model run costs come from the dated Teams catalog and
are labelled with their `asOf`. Compliance is never asserted: regulated data produces "verify a BAA /
DPA with the vendor" requirements, not "certified" badges. Every result carries
`validation.status = "not_validated"` until a real validation step exists.

**ADR-4 · Teams stays stateless by default; workspaces are opt-in.** The URL-encoded report remains
free and anonymous. Signing in adds an org workspace with saved, versioned assessments. Storage is a
`Store` interface with memory (tests), file (local) and Upstash REST (Vercel) backends. On Vercel without
a durable store, workspaces are switched off and say so — never silently backed by per-instance memory.

**ADR-5 · Self-contained auth.** Email + password (scrypt), opaque random session ids stored hashed
server-side (revocable), `HttpOnly; SameSite=Lax; Secure` cookies, Origin checks on mutations, rate-
limited login. Roles: owner > admin > member > viewer. Every repository call takes an `AuthContext`
and keys data by org id; cross-org reads are tested to fail.

**ADR-6 · Billing is off unless explicitly enabled, and never live by default.** `BILLING_MODE=off`
(default: everything free, no checkout) | `test` (requires `sk_test_` key) | `live` (requires `sk_live_`
key **and** `BILLING_ALLOW_LIVE=1`). Hosted Checkout only; entitlements are granted **only** by a
signature-verified webhook, recorded idempotently by event id. The success redirect grants nothing.

**ADR-7 · Control export is a documented contract behind an adapter.** `@aifit/control-export` defines
`GovernanceExport v1` (governance requirements, policy suggestions, agent inventory requirements,
evaluation evidence) with `"enforcement": "recommended-not-enforced"` as a literal. The default adapter
is a file download. An HTTP adapter exists behind `CONTROL_EXPORT_URL` and is off; no Control endpoint
is assumed to exist.

**ADR-8 · Consumer stays free and account-less.** README states Fit is free with no accounts. History
stays in the browser; activation counters are anonymous and allow-listed. Payments live in Teams.

## 7. Prioritised plan

1. **Unblock deploys** — Vercel root directory (done), Next security bumps, Turbopack root.
2. **Decision engine** (TS + Python, rules JSON, ≥10 fixtures, injection tests, `/v1/decision`).
3. **Consumer** — task check (five outcomes), tool comparison with honest cost, prompt + workflow
   templates, setup instructions, validated bundle with manifest + secret scan, local history,
   activation tracking.
4. **Platform package** — store, auth, orgs/roles, assessments repo (versioned), entitlements,
   Stripe Checkout + verified idempotent webhooks, account deletion.
5. **Teams** — decision section, auth pages, workspace, saved/reassess, blueprint JSON/Markdown,
   members, billing, privacy, Control export.
6. **Quality** — unit + browser e2e + axe accessibility for both apps, CI jobs.
7. **Release** — preview deployments, `docs/ai-fit-2/RELEASE.md` with real results.

## 8. Known blockers (need the owner)

- **Durable store for Teams on Vercel**: attach Upstash Redis (or Vercel KV) to `ark-ai-fit-teams` and
  set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. (No signing secret is needed: sessions are random tokens stored hashed.) Without these the
  preview runs the anonymous flows only.
- **Stripe test mode**: `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET`, price ids. Without
  them checkout is code-complete and unit-tested but unverified against Stripe.
- **Naming**: the existing code calls the sibling product "ARK Control"; this mission calls it "ARC
  Control". Assumed to be the same product; new contract names are neutral (`control-export`).
