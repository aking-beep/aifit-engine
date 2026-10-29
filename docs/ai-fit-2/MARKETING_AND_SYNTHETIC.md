# Marketing readiness and the synthetic test suite

Written 2026-10-29. Covers the go-to-market work (ARC calls to action, lead capture, analytics,
landing pages, legal drafts, password reset and email), the synthetic suite, and the Teams dependency
upgrades. Everything here is **off until configured**: with no environment variables set, both apps
behave as before, and every feature that needs an account says so plainly instead of pretending.

## What is built

| Area | AI Fit (Consumer) | AI Fit Teams | Turns on with |
|---|---|---|---|
| "Talk to ARC" / book an assessment | Landing, results, task check, `/app` | Header, landing, report verdict, workspace dashboard | Always on. Links carry `utm_source=<app>&utm_medium=product&utm_content=<placement>` and the visitor's original campaign |
| Lead form ("Get a follow-up from ARC") | Landing and audience pages, `POST /v1/leads` | Landing and audience pages, `POST /api/leads` | Upstash (stored) and/or `LEAD_WEBHOOK_URL` (forwarded, HMAC-signed). With neither, the form answers 503 and points to the booking link |
| Lead export | `GET /v1/leads` | `GET /api/leads` (JSON or `?format=csv`) | `LEADS_EXPORT_TOKEN` (24+ characters, bearer) |
| Analytics | Vercel Web Analytics (cookieless) | Same | Enable Web Analytics in each Vercel project |
| Conversion events | `assessment_started/completed`, `report_viewed`, `signup_completed`, `lead_submitted`, `booking_clicked`, `arc_site_clicked`, `checkout_started`, `landing_viewed` | Same names | Always sent to Vercel Analytics; to ad pixels only after consent |
| Ad pixels + consent banner | Meta, Google tag, LinkedIn | Same | `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GTAG_ID`, `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`. The banner appears only when a pixel is configured |
| Audience landing pages | `/for/professionals`, `/for/developers`, `/for/creators` | `/for/operations`, `/for/it-security`, `/for/small-business` | Always on. Each has its own Open Graph image, plus sitemap and robots |
| Legal | `/privacy`, `/terms`, `/refunds` | Same | **Drafts.** Each page says "Draft for review by counsel." |
| Password reset | `/reset`, single-use 30-minute token, all sessions ended | Same | Upstash plus `RESEND_API_KEY` and `EMAIL_FROM` |
| Transactional email | Reset, password changed, receipt, new-lead notice | Same, plus workspace invites | `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`, `LEAD_NOTIFY_EMAIL` |

ARC defaults: site `https://arc-website-pi-five.vercel.app` and booking
`https://calendly.com/aking-arctransformationgroup/30min`. Override with `NEXT_PUBLIC_ARC_SITE_URL`
and `NEXT_PUBLIC_ARC_BOOKING_URL` (for example, once ARC moves to its own domain).

## Owner actions, in order

1. **Upstash Redis** on both Vercel projects (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
   This turns on accounts, saved work, lead storage and password reset.
2. **Resend**: verify a sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM` on both projects.
   Set `LEAD_NOTIFY_EMAIL` to get an email for each lead.
3. **Optional CRM**: set `LEAD_WEBHOOK_URL` (HTTPS) and `LEAD_WEBHOOK_SECRET`. Verify the
   `X-AIFit-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">` header on receipt.
4. **Vercel Web Analytics**: enable it in each project's dashboard.
5. **Ad pixels**, only if you run paid ads: set the pixel IDs. Consent is collected before any pixel loads.
6. **Stripe test keys**, then one real test-card run of each product; live keys and
   `BILLING_ALLOW_LIVE=1` only after you approve.
7. **Legal review** of the privacy, terms and refund drafts by counsel.
8. **Custom domains**: add them in Vercel, point DNS, then set `NEXT_PUBLIC_SITE_URL` and `APP_URL`.
9. **Proof**: case studies and testimonials must come from real customers. None are invented here;
   the pages have no placeholder quotes.

## Synthetic suite

Three parts, all synthetic, none customer data:

1. **Workload library**: `packages/synthetic`, 50 workloads across 30 industries. Each case has
   an expected verdict set, outcome constraints, required compliance flags, a minimum security
   level and a rationale, all written before running the engine. Each case runs through
   `assess()` and `decide()` exactly as the Teams app does.
2. **Invariants**: these hold for every workload. Same input gives the same verdict, outcome,
   hash and cost. A not-ai verdict names no model, costs nothing and never picks buy/build AI.
   Estimates are finite, non-negative and ordered (low ≤ value ≤ high). Scores fall within 0–100.
   Irreversible actions with autonomy are never "automate". Zero tolerance is never "automate".
   Sensitive data gets controls. PHI, PCI and minors data raise their flags. The chosen outcome
   passed its hard constraints. No human cost is reported without a baseline. Nothing claims to
   be validated.
3. **Persona intake texts**: `packages/agents/evals/intake-personas.json`, 24 free-text
   descriptions written the way people talk (typos, run-on sentences, mixed units, two injection
   attempts). They are graded by the intake grader in live evals
   (`AIFIT_AGENTS=1 ANTHROPIC_API_KEY=… npm run eval --workspace @aifit/agents`). Unit tests check
   the cases' shape offline. Live evals cost API money, so they are not run in CI.

Run it with `npm run report --workspace @aifit/synthetic` (add `-- --json` for JSON output). CI runs
it as part of `test:teams` and writes the report to the job summary. A new miss fails CI until
someone reviews it. A recorded disagreement that the engine no longer shows also fails CI, so the
note cannot go stale.

### Results at commit time

- 50 cases, 0 invariant failures.
- 43 agree with the expected answer; 7 are reviewed disagreements.
- The engine says no where it should: not-ai on all 8 deterministic jobs, and not-yet on all 6
  blocker cases (irreversible actions under autonomy, credentials in the flow, zero tolerance with
  autonomous action).

The 7 disagreements come from three rubric behaviours. They are reported here instead of being
changed silently, because changing them moves verdicts that customers already see:

| Behaviour | Cases | Proposed change |
|---|---|---|
| Low error tolerance does not cap the verdict. Only `none` caps at "assisted", so a low-tolerance PHI triage with suggest-only autonomy reads "automate-bounded" | clinic-coding, prior-auth, patient-messages, cv-screening | Cap at "assisted" when tolerance is `low` **and** autonomy is suggest or approve |
| One regulated data class rates "low" security risk (+10 points; "low" runs to 21). The HIPAA/PCI flags and blocking controls are still there; only the headline level understates | clinic-coding, prior-auth, patient-messages, kyc-extract, card-disputes | Weight PHI, PCI, sensitive PII and minors at 22+ so any one of them alone is at least "moderate" |
| A trivial job (about 24 minutes a month) can still score 72+ on suitability. The decision engine correctly says no_change; the verdict line disagrees | works-fine | Cap the verdict at "assisted" when monthly hours are below the decision engine's negligible threshold |

What this proves and what it does not: the engines are consistent, refuse where they should, and
never contradict themselves. It does not show that customers agree with the answers. That needs
real pilots, with each pilot's outcome recorded against the verdict.

## Dependency upgrades (Teams)

- zod 3 → 4.6.7 everywhere, with one hoisted copy shared with the Anthropic SDK.
- Next 15.5 → 16.4.3 and React 18 → 19.2.8, the same versions as Consumer, with a single pinned React.

Evidence: all package suites (378 tests), Teams typecheck, production build, 62 unit tests and all
46 Playwright tests pass. `npm audit` reports 0 vulnerabilities.
