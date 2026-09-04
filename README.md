# AI Fit Engine

AI Fit Engine is a behavioral assessment and recommendation platform that helps a person determine:

1. **How they tend to collaborate with AI** — based on observable interaction behavior.
2. **Which AI products fit their workflows** — not just which foundation model.
3. **Which underlying models fit specific task categories** — research, coding, strategy, multimodal work, etc.
4. **What AI persona/configuration should be used with those tools** — generated as portable instructions.
5. **What their recommended AI stack is** — with evidence and fit explanations.

The public experience is a game-like assessment. The open-source core contains the behavioral measurement, product registry, fit engine, scoring, and export adapters.

## Product thesis

The AI market is increasingly difficult for users to navigate. "Best AI" lists are generic, products change quickly, and the same user may need different products for different workflows.

AI Fit Engine asks a different question:

> Which AI products, models, and working configurations fit how *you* actually work?

The system does not claim to diagnose personality, cognition, intelligence, or psychological traits. It measures **observable interaction patterns inside the assessment** and maps those signals to an explicitly maintained product/model capability registry.

## v0.1 outputs

Every completed assessment should return:

- **Interaction Signature**
- **Top product matches by category**
- **Top model matches by workload**
- **Recommended AI stack**
- **Generated AI working persona**
- **Fit rationale**
- **Evidence behind each behavioral score**
- **Confidence**
- **Exportable configuration files**

Initial export targets:
- Generic system prompt
- `CLAUDE.md`
- `AGENTS.md`
- Cursor rules
- Markdown profile
- JSON profile

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

## Recommended monorepo stack

- **Frontend:** Next.js + TypeScript
- **API:** FastAPI + Python
- **Scoring engine:** Python
- **Registry:** versioned JSON/YAML initially; Postgres later
- **Database:** PostgreSQL/Supabase when persistence is needed
- **Analytics:** privacy-conscious event analytics
- **LLM layer:** provider-agnostic adapter
- **Testing:** pytest + Vitest/Playwright later
- **CI:** GitHub Actions

## Start here

Read these files in order:

1. `docs/PRODUCT_SPEC.md`
2. `docs/ASSESSMENT_DESIGN.md`
3. `docs/SCORING_SPEC.md`
4. `docs/REGISTRY_SPEC.md`
5. `docs/PERSONA_SPEC.md`
6. `docs/ETHICS_PRIVACY.md`
7. `docs/ROADMAP_4_WEEKS.md`
8. `docs/DEFINITION_OF_DONE.md`

Then give your coding agent:

`prompts/00_MASTER_BUILD_PROMPT.md`

## First local milestone

The first meaningful backend command should be:

```bash
python -m aifit.cli score examples/sample_session.json
```

It should return:

- interaction metrics
- a user fit vector
- ranked product matches
- ranked model matches
- a generated persona payload

The frontend can come after the deterministic scoring path works.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
aifit score examples/sample_session.json
PYTHONPATH=packages/core/src uvicorn services.api.main:app --host 127.0.0.1 --port 8472
```

In another terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open the assessment at `http://127.0.0.1:43123`. The Next.js app proxies `/v1` and `/health` to the API so scoring stays server-side.
