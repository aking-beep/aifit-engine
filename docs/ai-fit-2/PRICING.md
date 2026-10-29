# AI Fit Teams — pricing decision (2026-10-29)

| Plan | Before | Now | What it unlocks (enforced in `packages/platform/src/entitlements.ts`) |
|---|---|---|---|
| Assessment, one workload | $299 one-time | **$149 one-time** | Cost model, ROI, editable risk register, security and governance requirements |
| Blueprint, one workload | $999 one-time | **$399 one-time** | Assessment, plus architecture, models, infrastructure, evaluation plan, roadmap, and the blueprint download |
| Workspace | $299 / month | **$199 / month** | Blueprint level for every workload, unlimited workloads and versions, roles and audit log, the governance export. Up to 25 members |

The verdict and the build-vs-buy-vs-automate comparison stay free.

Displayed prices live in `packages/design/src/config.ts`. **Stripe Price IDs are the authority at checkout:**
create the Stripe prices at these amounts (`STRIPE_PRICE_ASSESSMENT`, `STRIPE_PRICE_BLUEPRINT`,
`STRIPE_PRICE_TEAM_MONTHLY`). Consumer Pro is unchanged at $12/month.

## The market (published or reported prices, October 2026)

| Alternative | Price | Notes |
|---|---|---|
| Free readiness quizzes | $0 | Score-only; they do not produce a cost model or a blueprint |
| Small-business AI readiness consultants | $1,499–$8,000 per assessment | Fixed fee; 2 days to 3 weeks of human work. Fees under about $2,000 are often sales calls |
| Mid-market readiness audits | $5,000–$35,000 | |
| Self-serve AI governance (Vireo Sentinel) | $55/month for 5 users; $220/month for 20 | Governance only; no build-vs-buy or cost model |
| Self-serve AI governance (Adeptiv AI) | From $0 (trial limited to 2 use cases) | |
| Enterprise AI governance (IBM) | From $3,500/month | |
| Enterprise AI governance (Credo AI) | Reported from about $30,000/year | Quote only |
| Prioritisation SaaS (Priority Matrix, Aha!, Productboard) | $12–$59 per user per month | |

The figures come from vendor pages and third-party roundups found by web search. They were not
verified against each vendor's own pricing page, so treat them as indicative. Consumer rivals are
mostly free quiz-style recommenders funded by affiliate links. AI Fit's paid differentiation is
validated setup files, account history and no affiliate ranking.

## Why these numbers

- **Not luxury.** At $999 the old blueprint sat within reach of the cheapest human consultant
  ($1,499). That is a hard sell for self-serve software that does not talk to you. At $399, a
  blueprint costs about a quarter of the cheapest consultant fee. The $149 assessment costs about a
  tenth, which is low enough to buy on a card without a procurement step.
- **Not too cheap.**
  - Stripe takes about 3% at every new price point, so net revenue per sale is $144, $387 and
    $193 a month.
  - Hosting (Vercel, Upstash) is fixed and small, and the optional AI explainer costs cents per
    run. Contribution margin stays above 95%.
  - Under an assumed $1,000 a month of fixed running costs (hosting plus about 10 hours of
    support), about **5 workspaces or 3 blueprints a month** cover them.
  - Going lower (for example $49 or $99) would need volume in the hundreds to fund support and
    liability for a product whose output informs spending decisions.
- **A clear upgrade path.**
  - The workspace beats buying a blueprint for a team that needs one blueprint every two months
    ($199 against $399).
  - It beats one-off assessments at 1.34 a month.
  - At 25 members it works out to $8 per seat, below every per-seat comparison above, and below
    Vireo's 20-user governance tier while doing more.
- **Room to move.**
  - Annual billing (for example two months free) and a larger-team tier can be added later
    without lowering list prices.
  - Neither exists in code today.

## Not decided here

- Refund policy, taxes and an annual plan.
- Whether the workspace member cap should rise.
- Live billing stays off until the owner approves it.
