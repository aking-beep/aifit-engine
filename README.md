# Workprint

Workprint is a 5-minute adaptive diagnostic that answers:

**How do you work with intelligence — and how should your AI be configured?**

You leave with:

1. **AI Workstyle** — a named interaction profile, not a personality type.
2. **Why** — the behaviors that produced that profile.
3. **Interaction dimensions** — autonomy, verification, iteration, context depth, tool delegation, source dependency, exploration.
4. **Recommended stack** — what each product should handle.
5. **Model routing** — which model for which workload.
6. **Working persona** — how AI should interact with you.
7. **Installable files** — ChatGPT, Claude / CLAUDE.md, Gemini, Cursor rules, AGENTS.md.

This is a **free individual diagnostic**. It is not a $10/month “which AI should I use?” subscription.

Source: [github.com/aking-beep/aifit-engine](https://github.com/aking-beep/aifit-engine).

Workprint is a working product name, distinct from the unrelated business-matching site at aifitengine.com. Domain and trademark clearance still needed before a public brand lock.

## What it measures

Workprint scores **what you ask, how you steer, and how much evidence you demand**. Two people with the same job, budget, and skill level can need different AI configurations.

The diagnostic usually stops after four scenarios (about twelve interactions). It continues only when a core dimension still lacks signal, and never past eight.

An LLM may label optional free text. It never picks the winner. Ranking is dated registries + weights.

## Limitations

- The catalog in `data/registry/` is **illustrative seed data**. Re-validate every row before public recommendations (`docs/REGISTRY_SEED_REVIEW.md`).
- Sessions are **in-memory**. Restarting the API drops them. There are no accounts.
- Keyword classification is first-class. The optional LLM classifier is off unless `AIFIT_LLM_CLASSIFIER=1` and an endpoint is set.
- Fit scores are normalized similarity, not scientifically validated probabilities.
- Not a personality test, clinical instrument, or hiring screen.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
aifit score examples/sample_session.json
aifit freshness
PYTHONPATH=packages/core/src python3 -m evals.harness validate-seed
PYTHONPATH=packages/core/src python3 -m evals.harness run-cases
PYTHONPATH=packages/core/src uvicorn services.api.main:app --host 127.0.0.1 --port 8472
```

In another terminal:

```bash
cd apps/web
npm install
npm run dev
# or a production-style preview: npm run build && npm run start
```

Open `http://127.0.0.1:43123`.

Frontend happy path:

```bash
cd apps/web
npx playwright install chromium
npm run test:e2e
```

## Deploy on Vercel

This repo is a Vercel Services project: Next.js in `apps/web` and FastAPI at `/v1` and `/health` on the same domain. Scoring stays Python.

```bash
npx vercel login
npx vercel
npx vercel --prod
```

Import the Git repo in the Vercel dashboard if you prefer. Leave the root directory at the repository root so `vercel.json` can see both services. Do not set the root to `apps/web`.

On Vercel, assessment events are buffered in the browser and scored in one request. Share links include a compressed snapshot in the URL hash because serverless functions do not share memory.

## Architecture

```text
Interactive diagnostic
        │
        ▼
Behavioral signals
        │
        ▼
AI Workstyle
        │
        ▼
Capability requirements
        │
        ├───────────────┐
        ▼               ▼
Product Registry   Model Registry
        │               │
        └───────┬───────┘
                ▼
           AI stack
                │
                ▼
      Persona + install guides
                │
                ▼
 Portable AI operating profile
```

The registry, methodology, and evidence live under **Transparency**. They are credibility infrastructure, not the homepage.

## Pack docs

1. `docs/PRODUCT_SPEC.md`
2. `docs/ASSESSMENT_DESIGN.md`
3. `docs/SCORING_SPEC.md`
4. `docs/REGISTRY_SPEC.md`
5. `docs/PERSONA_SPEC.md`
6. `docs/ETHICS_PRIVACY.md`
7. `docs/ROADMAP_4_WEEKS.md`
8. `docs/DEFINITION_OF_DONE.md`
