# AI Fit 2.0 — Magic Patterns integration: inspection and compatibility matrix

Phase 1 of the full-integration mission, 2026-10-29. This document records what exists, what the
Magic Patterns exports contain, and how each exported piece maps onto real functionality.

## 1. What exists (the real application)

| Layer | Consumer (AI Fit) | Teams (AI Fit Teams) |
|---|---|---|
| Frontend | `apps/web`: Next 16.4, React 19, Tailwind 4 + shadcn tokens. **Not** in the npm workspace (own lockfile) | `apps/teams`: Next 15.5, React 18, Tailwind 3 with the `@aifit/ui` dark "ink" preset |
| Backend | FastAPI `services/api/main.py`, Python `aifit` package | Next route handlers in `apps/teams/src/app/api/**` |
| Assessment engine | Scenario quiz → `score_session` → persona + `rank_products` (registry) | Eight-step intake → `assess()` (`@aifit/teams-core`): suitability, routing, cost |
| Recommendation engine | Shared five-outcome decision engine, Python mirror `aifit.decision` (`/v1/decision`) | `@aifit/decision-core` (`decisionFor`) |
| Deliverables | Setup bundle (`/v1/export/{target}`, validated, secret-scanned) | Blueprint MD/JSON (`@aifit/deliverables`), GovernanceExport v1 |
| Persistence | `ResultStore` (Upstash or file): sessions, shares, counters. No accounts | `@aifit/platform` KvStore (Upstash/file/memory): users, orgs, versioned assessments, entitlements, audit |
| Auth | None (session tokens for quiz sessions only) | scrypt passwords, hashed session tokens, roles owner/admin/member/viewer, org isolation |
| Billing | None | `BILLING_MODE off|test|live`, Stripe Checkout, verified idempotent webhooks, blueprint purchase + team subscription |
| Agents | Intake interpreter + explainer (off by default) | Same, plus weekly price/registry verifier |
| Tests | pytest 138, Playwright 32 | node:test 354 (all TS packages), Playwright 26 |
| Deploy | Vercel `aifit-engine` (services: Next + FastAPI) | Vercel `ark-ai-fit-teams` (Root Directory `apps/teams`) |

There is no relational database. Both products persist through key-value stores; without Upstash on
Vercel the durable features are switched off and say so (`/health`, `/signin`).

## 2. What the exports contain

`design/magic-patterns/` holds three Vite + React 18 + Tailwind 4 + react-router exports.

- `ai-fit-design-system/src/ds`: 21 component modules, types, plan config, tokens (`index.css`).
  Byte-identical in all three exports. It does not use the router: navigation is passed in as callbacks.
- `ai-fit-teams/src/pages`: 22 screens on sample data (`ds/sample/teams.ts`).
- `ai-fit-consumer/src/pages`: 14 screens on sample data (`ds/sample/consumer.ts`) plus a context store.
  The consumer export also carries an unused copy of all Teams pages.

Every interaction in the pages is local state or simulated:
- engine progress is a timer;
- "checkout" is a toast;
- invites and role changes are local;
- `DATA_MODE = 'sample'`.

## 3. Integration architecture

| Decision | Choice | Why |
|---|---|---|
| Design system home | `packages/design` (source of truth), vendored into `apps/web/src/design` and `apps/teams/src/design` by `scripts/sync-design.mjs`; a test fails if a copy drifts | Consumer is outside the workspace and on React 19; importing source across the repo would resolve the root's React 18 and break hooks |
| Styling | Tailwind 4 in both apps, one tokens file (`packages/design/tokens.css`) | DS uses v4 `@theme`/`@custom-variant`. Teams moves from v3 to v4, keeping the old `ink-*` and `signal` names as compatibility tokens until every screen is migrated |
| shadcn tokens in Consumer | Replaced by DS tokens; shadcn components retired as screens move to DS | `accent` and `rounded-*` clash in meaning |
| Routing | Exported `MemoryRouter` paths become real Next routes | Deep links, history and SSR |
| Data | Every screen reads the engine, store or registry. Sample files are not shipped in either app | "No mock data presented as production data" |
| Prices | Plan list prices from `packages/design/src/config.ts` (the design's values) | Stripe Price IDs are the authority at checkout |
| Consumer accounts and billing | New Python modules (`aifit.accounts`, `aifit.billing`) behind the existing FastAPI, same rules as `@aifit/platform` | Consumer's backend is Python, and its frontend cannot import `@aifit/platform` |
| Entitlement limits | Enforced server-side only when billing is on; with billing off everything stays free, as today | Preserves existing free behaviour |

## 4. Design system compatibility

| Module | Reuse | Adaptation needed |
|---|---|---|
| lib, types | Direct | `VERDICT_META` keys map from engine outcomes (`no_change→no-ai`, `conventional_software→software`, `conventional_automation→automation`, `buy_ai→buy`, `build_ai→build`) |
| config | Direct for plans and stages | `DATA_MODE` becomes `'live'` |
| Theme | Adapt | `'use client'`. Persist the choice (localStorage) and respect `prefers-color-scheme`. Set before paint to avoid a flash |
| Button, Panel, Tabs, Forms, Evidence, ReasonList, CostTable, Risk, EvalResults, StageRail, Pricing | Direct | `'use client'` where they hold state |
| Feedback | Adapt | `EngineProgress` must reflect real request state, not a timer. `SampleDataTag` is dropped |
| Overlay | Adapt | `createPortal` only after mount (SSR) |
| ArchitectureDiagram | Adapt | Unique SVG marker ids (`useId`) |
| DownloadPreview | Adapt | Real downloads come from server endpoints (bundle zip, blueprint MD/JSON). Preview content comes from the server |
| AppShell | Adapt | Link component injected (`next/link`). No sample tag. Account footer comes from the session |
| RecommendationCard | Direct | Fed from registry products: evidence, `last_checked`, privacy fields |

## 5. Screen matrix

Legend:
- **Real**: backed by existing functionality.
- **New backend**: needs new server code (built in this mission).
- **Derived**: deterministic from engine output, labelled as such.
- **Hidden**: behind a flag or not shipped.

### Teams

| Export screen | Next route | Data source | Status |
|---|---|---|---|
| TeamsLanding | `/` | Plan config; live engine run on the documented example workload (labelled "Example") | Real |
| OrgOnboarding | `/signup` then `/onboarding` | Sign-up + org profile (industry, size, regions, data classes) | New backend (org profile) |
| TeamsDashboard | `/workspace` | Saved assessments, audit log | Real |
| Workspace (portfolio) | `/workspace/portfolio` | Saved assessments | Real |
| Intake | `/assess` | Existing eight-step intake | Real (restyled) |
| Verdict | `…/verdict` | `assess()` + decision engine | Real |
| BuildVsBuy | `…/build-vs-buy` | Decision comparison, per-factor contributions | Real. Weight sliders are not offered: rules weights are fixed and published, so user weights would contradict the engine |
| CostModel | `…/cost` | `assess().cost`, blueprint effort lines | Real |
| Roi | `…/roi` | `teams-core` value economics; sliders recompute through the core package | Real |
| Architecture | `…/architecture` | Blueprint architecture → diagram graph (deterministic adapter in `@aifit/deliverables`) | Derived |
| Models | `…/models` | Routing candidates from the dated catalog. Quality and latency show as "Not tested" | Real |
| Infrastructure | `…/infrastructure` | Residency, pattern and milestone-derived environments | Derived (labelled Recommendation) |
| Governance | `…/governance` | Required controls + GovernanceExport requirements; "Export to ARC Control" | Real |
| Security | `…/security` | Blueprint security controls and compliance flags | Real |
| RiskRegister | `…/risks` | Derived risks + persisted owner/status/mitigation edits per assessment | Derived + new backend |
| Evaluation | `…/evaluation` | Blueprint evaluation plan. Every check is "Not tested": no run happens inside AI Fit | Real (no fake runs) |
| Roadmap | `…/roadmap` | Blueprint milestones | Real |
| Blueprint | `…/blueprint` | Entitlement-gated MD/JSON download, preview from server | Real |
| TeamsHistory | `/workspace/history` | Assessment versions | Real |
| Admin | `/workspace/admin` | Members, invites, roles, audit | Real |
| Billing | `/workspace/billing` | Entitlements, purchases, payment history, Checkout | Real + new backend (assessment product, payments, refunds) |
| TeamsSettings | `/workspace/settings` | Org name, account export/delete, theme | Real. SSO toggle hidden (no SSO) |

The anonymous report (`/report?w=`) keeps working and renders the same sections from the link.

### Consumer

| Export screen | Next route | Data source | Status |
|---|---|---|---|
| Landing | `/` | Plan config, real copy | Real |
| Onboarding | `/onboarding` | Name and role, saved to the account (role pre-fills the task check). The export's "current tools" step is not carried over: no engine reads it | New backend |
| Assessment | `/assessment` | Existing scenario quiz | Real (restyled) |
| Dashboard | `/app` | Latest saved quiz, top tools, saved task checks, saved items; stage from what the account has done | Real |
| Profile | `/app/profile` | The saved, server-scored result in the existing results view | Real |
| Tools | `/app/tools` | Ranked products from the saved result; trimmed to 3 by the server on Free when billing is on | Real |
| Compare | `/app/compare` | Registry fields with evidence and last-checked dates. Prices only as recorded tiers | Real |
| Workflows | `/app/workflows` | Task checks (five-outcome decisions) as goal → verdict → steps | Real |
| Configure | `/app/configure` | Validated setup bundle (zip), preview of its files | Real |
| Saved | `/app/saved` | Saved tools (account) | New backend |
| History | `/app/history` | Quiz results and task checks (account and browser) | Real |
| Upgrade | `/app/upgrade` | Stripe Checkout (Pro, test mode) | New backend |
| Subscription | `/app/subscription` | Subscription state, payment history, checkout return polling, Stripe billing portal | New backend |
| Settings | `/app/settings` | Account profile, export, delete, theme | New backend |

## 6. Claims in the exports that are not carried over

These are sample figures. None of them is shown as fact in the integrated apps:
- tool prices ("~$20/mo");
- model quality scores (0.91);
- latency;
- eval results (94.1%);
- "140 tools";
- infrastructure choices (AWS eu-central-1, Bedrock);
- named people and companies;
- invoices.

Where the design shows such a figure, the integrated screen shows the engine's value with its basis,
or "Not recorded" / "Not tested".

## 7. Not attempted

| Item | Why |
|---|---|
| SSO enforcement toggle | No SSO exists. The control is hidden, not faked |
| Teams billing portal | Not wired on Teams; card changes happen in Stripe. Consumer opens the Stripe portal (needs the portal configured in Stripe) |
| Running evaluations | AI Fit plans evaluations; it does not execute them against a customer's system |
