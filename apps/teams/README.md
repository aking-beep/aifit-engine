# AI Fit Teams

AI Fit Teams is the estimator: a team describes one workload, and the report says whether to use AI at
all, what to build, what it costs per successful outcome, and what has to be true before launch. Every
figure carries its basis: `heuristic`, `benchmark`, `calibrated` or `measured`. `PRODUCT.md` is the
product record.

It moved here from the ARK monorepo (`aking-beep/ark`, `apps/business`, package `@ark/business`) with
its git history. It is a separate product from Fit (`apps/web`). The two do not link to each other,
and Teams does not import the Python engine.

## Layout

```text
apps/teams/                      this app (Next.js 15, React 18, port 3001)
packages/teams-core/             Teams' slice of ARK @ark/core: assess, schemas, catalog, economics, calibration client
packages/ui/                     the @ark/ui primitives Teams renders, and the Tailwind preset
packages/calibration-contract/   the frozen GET /api/v1/calibration contract, with a JSON Schema and fixture responses
```

All four are one npm workspace, declared in the repository-root `package.json`. `apps/web` and the
Python code are not part of it.

## Run locally

Node 22.6 or later.

```bash
npm install                      # at the repository root
npm run dev --workspace @aifit/teams   # builds the packages, then http://localhost:3001
```

Tests (contract, teams-core, ui, then the app's own):

```bash
npm run test:teams               # at the repository root
```

`npm run build --workspace @aifit/teams` builds the packages and then `next build`.

## Environment

Copy `.env.example`. Every variable is optional.

| Variable | Read by | Effect |
|---|---|---|
| `ARK_CONTROL_URL` | report page, `POST /api/assess`, header nav | Control origin for the calibration read. Unset: no request is made and the report is uncalibrated. Also the header's "ARC Control" link, which falls back to `http://localhost:3002` when unset. |
| `ARK_CONTROL_TOKEN` | calibration client | Sent as `Authorization: Bearer …`. Control derives the org from it. Without it, Control answers 401. |
| `ARK_TRUSTED_PROXY_HOPS` | `POST /api/measure` rate limit | Which `X-Forwarded-For` entry to trust. No visible effect in this build (see measure mode). |
| `ARK_MEASURE_ENABLED` | `/api/measure`, report page | Needs to be `1` **and** the build must carry ARK Runtime. This build does not, so measuring stays off. |
| `ARK_OLLAMA_MODEL` | measure mode only | The installed Ollama tag a sample would use. |
| `ARK_OLLAMA_URL` | an ARK Runtime executor | Not read by this build. Listed so a deployment's env can be copied across. |

**Without Control, every figure reads `heuristic`.** With `ARK_CONTROL_URL` unset, or Control down,
slow (over 2.5 s), answering anything other than 200, or sending a body that does not match the
contract, the assessment uses the ARK rubric and every provenance-bearing figure is labelled
`heuristic`. The report still renders in full. That is the primary path, not a degraded one, and
`packages/teams-core/src/calibration/contract.test.ts` checks it.

## Workspaces, deliverables and billing

The anonymous report is unchanged: nothing is stored and it is free. Signing up adds an org workspace:

- **Accounts** — email + password (scrypt), opaque session tokens stored only as SHA-256, `HttpOnly;
  SameSite=Lax; Secure` cookies, Origin checks on every mutating route, store-backed rate limits.
- **Roles** — owner, admin, member, viewer (`packages/platform/src/orgs.ts`, one table). Invites are
  one-time, email-bound links; the token travels in the URL fragment.
- **Saved assessments** — the Workload plus a snapshot of verdict, decision outcome and engine
  versions; reassessing adds a version on the same root. Another org's id reads as 404.
- **Deliverables** — technical blueprint (Markdown / JSON, `@aifit/deliverables`) and the governance
  export for ARC Control (`@aifit/control-export-contract`, recommendations only). PDF: print the report.
- **Billing** — `BILLING_MODE=off` by default. In `test` mode the blueprint (per assessment) and the
  export (team plan) are gated server-side; Checkout is Stripe-hosted; only a signature-verified,
  idempotently applied webhook grants anything. `live` needs an `sk_live_` key and `BILLING_ALLOW_LIVE=1`.
- **Account** — JSON export of everything stored and self-serve deletion; a sole owner of a shared
  workspace, or a workspace with an active plan, must resolve that first.

Without `UPSTASH_REDIS_REST_URL`/`TOKEN` on Vercel, workspace pages say they are off and why. Locally a
file store under `.data/` is used. See `.env.example` for every variable.

Browser tests: `npm run test:e2e --workspace @aifit/teams` (after `npm run build:teams`). They start two
production servers (billing off, and Stripe test mode with fake keys and locally signed webhooks).

## The wire to ARC Control

This build talks to Control over exactly one HTTP call:

```text
GET ${ARK_CONTROL_URL}/api/v1/calibration?days=30
accept: application/json
authorization: Bearer ${ARK_CONTROL_TOKEN}      (when set)
```

`fetchCalibration` (`packages/teams-core/src/calibration/client.ts`) runs it once per full report view
(a verdict-only link makes no call) and once per `POST /api/assess` (once for a whole batch). It returns a `CalibrationSet` or `null`. It
never throws and never applies part of a response.

The response shape is `@aifit/calibration-contract`, copied field for field from
`aking-beep/ark@f4f52ce packages/core/src/calibration/priors.ts`, where Control's `buildCalibration`
also lives. `fixtures/` holds the answers Control gives: `measured` (the org has 30 or more of its own
traces), `calibrated` (fleet priors from 3 or more other orgs), a thin own set below the floor, a 401,
and a 200 that breaks the contract. A pattern with fewer than 30 observed outcomes is ignored, so its
figures stay `heuristic`. A cost figure is promoted to `calibrated` at most, never `measured`, because
it is an observed call shape multiplied by list prices.

To change the contract, change it in ark first, then bump `CALIBRATION_CONTRACT_VERSION` and update the
schema and fixtures here.

## Measure mode

In ark, `POST /api/measure` (with `ARK_MEASURE_ENABLED=1`) ran one synthetic sample through
`@ark/runtime`, which then posted the trace to `${ARK_CONTROL_URL}/api/v1/events` with
`ARK_CONTROL_TOKEN`, under a `teams_sample_` workload id. That is a second wire to Control.

This build does not include ARK Runtime, so it does not have that wire. `src/lib/measure.ts` runs
samples through a `SampleExecutor` interface and ships `BUNDLED_EXECUTOR = null`. `POST /api/measure`
always answers 404 `disabled`, and `GET /api/measure` reports `requested` and `runtimeBundled` so an
operator can see why. The gate, rate limits, sample namespace, prompt and timeout are kept and tested.
To bring measuring back, wire in an executor backed by a published `@ark/runtime` and set
`BUNDLED_EXECUTOR`. That is a deliberate change, which re-adds the `/api/v1/events` wire on purpose.

## Deploy on Vercel

Teams deploys as its own Vercel project, separate from the Fit project at the repository root:

- **Root Directory:** `apps/teams`
- **Include files outside the Root Directory in the Build Step:** on (the default). The build needs
  the workspace packages and the root lockfile.
- **Framework:** Next.js. `apps/teams/vercel.json` sets the install command to `cd ../.. && npm ci`
  (the workspace root) and the build command to `npm run build`, which builds the packages and then
  the app.
- **Node.js version:** 22.x.
- **Environment:** `ARK_CONTROL_URL` (Control's public origin) and `ARK_CONTROL_TOKEN`. Leave
  `ARK_MEASURE_ENABLED` unset.

The repository-root `vercel.json` is the Fit project's config (`apps/web` plus the FastAPI service).
Teams does not use it.

## Routes

- `/` intro, `/assess` intake, `/report` result, `/methodology`, `/privacy`.
- `/signup`, `/signin`, `/workspace`, `/workspace/assessments/[id]`, `/invite`, `/billing`, `/account`.
- `/api/auth/*`, `/api/workspace`, `/api/workspace/members`, `/api/invites/accept`, `/api/assessments`
  (+ `/[id]`, `/[id]/reassess`, `/[id]/blueprint`, `/[id]/control-export`), `/api/blueprint` (anonymous,
  billing off only), `/api/billing/{checkout,webhook,status}`, `/api/account`.
- `POST /api/assess` scores one `Workload` or up to 20. `GET /api/assess` describes it.
- `POST /api/measure` is disabled in this build (see above).

Intake is encoded into the report link and the assessment is recomputed on every view. Nothing the
user enters is stored on the server unless a signed-in user saves it to a workspace.
