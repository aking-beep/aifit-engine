# AI Fit Engine

AI Fit Engine is a behavioral assessment that answers:

1. **How you tend to collaborate with AI** — from observable interaction, not personality.
2. **Which AI products fit those workflows** — products stay distinct from models.
3. **Which models fit specific workloads** — research, coding, reasoning, multimodal, local control.
4. **What working configuration to give those tools** — portable persona exports.
5. **What stack to start with** — a primary stack, an alternative, and evidence for every score.

This is not a personality test, IQ instrument, clinical tool, or hiring screen.

## Product thesis

Generic “best AI” lists ignore how a person actually works. AI Fit Engine scores what you ask for, how you steer, and how much evidence you demand, then ranks a dated product/model registry with explicit weights. An LLM may label free text. It never picks the winner.

## Methodology

1. Eight scenarios, three rounds each, capture structured interaction events.
2. Events become a 0–1 metric vector with confidence from observation count and scenario spread.
3. Products and models live in separate JSON registries. Every public row has `last_evaluated_at` and evidence.
4. Fit is weighted similarity, then capability/cost/local filters, then a freshness penalty. Stale rows lose confidence; they are not marked “bad.”
5. Results show an interaction signature, stacks, products by category, models by workload, evidence, and exports.

Scoring stays server-side. The Next.js app proxies `/v1` and `/health` to the API.

## Limitations (v0.1)

- The catalog in `data/registry/` is **illustrative seed data**. Re-validate every row before public recommendations (`docs/REGISTRY_SEED_REVIEW.md`).
- Sessions are **in-memory**. Restarting the API drops them. There are no accounts.
- Keyword classification is first-class. The optional LLM classifier is off unless `AIFIT_LLM_CLASSIFIER=1` and an endpoint is set.
- Fit scores are normalized similarity, not scientifically validated probabilities.
- Do not use this for hiring, screening, or clinical decisions.

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

## v0.1 outputs

- Interaction signature with evidence and confidence
- Top products by category
- Top models by workload
- Primary and alternative AI stacks
- Generated working persona
- Exports: generic prompt, `CLAUDE.md`, `AGENTS.md`, Cursor rules, JSON
- Anonymous share link, session export, and delete
- Feedback on recommendations

## Architecture

```text
Assessment Game
      │
      ▼
Interaction Event Engine
      │
      ▼
InteractionBench
      │
      ├── behavioral signals
      ├── evidence
      └── confidence
      │
      ▼
User Fit Vector
      │
      ├───────────────┐
      ▼               ▼
Product Registry   Model Registry
      │               │
      └───────┬───────┘
              ▼
          Fit Engine
              │
      ┌───────┼───────────┐
      ▼       ▼           ▼
 Products   Models      AI Stack
              │
              ▼
        Persona Generator
              │
              ▼
          Export Layer
```

## Pack docs

1. `docs/PRODUCT_SPEC.md`
2. `docs/ASSESSMENT_DESIGN.md`
3. `docs/SCORING_SPEC.md`
4. `docs/REGISTRY_SPEC.md`
5. `docs/PERSONA_SPEC.md`
6. `docs/ETHICS_PRIVACY.md`
7. `docs/ROADMAP_4_WEEKS.md`
8. `docs/DEFINITION_OF_DONE.md`
