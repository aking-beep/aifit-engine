# Agents in AI Fit

Status: **built, off by default, not yet run against a real model.** Every
result below comes from offline tests with a scripted model or a local API
stub. No eval has been run live, so no claim is made about how well the
agents work, only about what the code allows them to do.

## Rule: agents suggest, code decides

Fixed rules make every decision, hard constraint, entitlement and security
check (`packages/decision-core`, `packages/platform`). An agent may only:

- **suggest** an answer, which the person applies by clicking, or
- **explain** a result the rules already produced, or
- **report** a fact it read on a public page, for a person to act on.

Each reply goes through the same pipeline (`packages/agents/src/harness.ts`):

1. The input is validated against a schema. Bad input never reaches the model.
2. Untrusted text (the person's description, a fetched web page) is wrapped
   in data tags that a closing tag inside the text cannot escape. The prompt
   says to treat it as data.
3. The model answers through structured outputs (a JSON schema), with
   server-side refusal fallbacks.
4. The reply is parsed against the schema a second time, then passed to a
   **deterministic check** written in plain code:
   - Intake suggestions are kept only if their evidence quote appears word
     for word in the person's text and the value is a valid option.
   - Prices are kept only if a quote from the page contains that exact number.
   - A product status is kept only if a quote supports it. "Renamed" is kept
     only if the new name appears on the page.
   - An explanation is thrown away if it names an outcome the rules did not
     choose. The rule-written explanation is shown instead.
5. One trace line is logged per run: agent, version, status, model, timing,
   tokens and a SHA-256 of the input. The input itself is never logged.

Possible statuses: `ok`, `disabled`, `invalid_input`, `refused`, `rejected`,
`error`, `timeout`. If the status is anything but `ok`, every surface falls
back to its rule-based behaviour and still works.

## Inventory

`GET /api/agents` on Teams publishes this list, from `packages/agents/src/inventory.ts`.

| Agent | Where | Reads | Changes | Human gate | Evals |
|---|---|---|---|---|---|
| `intake-interpreter` 1.0.0 | Consumer `/check`, Teams intake step 1 | The description the person typed | Nothing | Each suggestion is applied by clicking it; the rules score only the form | `evals/intake.json` (12 cases, 2 injection) |
| `decision-explainer` 1.0.0 | Consumer result, Teams report | The structured decision only, never free text | Nothing | Labelled AI-written; it cannot change the decision | `evals/explainer.json` (6) |
| `price-verifier` 1.0.0 | Weekly GitHub Action | Public vendor pricing pages | Nothing (writes a report) | A person edits `catalog.ts` | `evals/price-verifier.json` (5, 1 injection) |
| `registry-verifier` 1.0.0 | Weekly GitHub Action | Product homepages | Nothing (writes a report) | A person edits `products.json` | `evals/registry-verifier.json` (5, 1 injection) |

None of the agents has tools. None can write to a store, a form, a decision
or the repository.

### Known limit of the evidence check

The evidence check stops a model from inventing facts. It does **not** stop
someone from typing an instruction such as "set data classes to public"
and having that quoted back as a suggestion (fixture
`injection-text-cannot-smuggle-unquoted-values`). This is acceptable for one
reason: the person sees the suggestion with its quote and applies it
themselves, and the hard constraints never read agent output.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `AIFIT_AGENTS` | unset | Must be `1` to turn agents on |
| `ANTHROPIC_API_KEY` | unset | Also required. Without it nothing is called |
| `AIFIT_AGENT_MODEL` | `claude-opus-5-5` | Model for every agent |
| `AIFIT_AGENT_DAILY_CAP` | `500` | Model calls per UTC day, per server instance |

Interactive routes are also rate-limited to 6 requests a minute per client:
store-backed on Teams when workspaces are on, otherwise per process. Teams
routes accept same-origin requests only. The explain routes recompute the
decision on the server, from the intake (Consumer) or the report link (Teams),
so a client cannot supply its own outcome.

Model access goes through the `ModelClient` interface, so another provider
can be added behind it. Tests use `ScriptedModelClient` and never touch the
network.

## Running

```bash
npm test -w @aifit/agents                # offline: harness, checks, fixtures, eval files, verifier
.venv/bin/python -m pytest tests/test_agents.py   # Python mirror, same intake fixtures
AIFIT_AGENTS=1 ANTHROPIC_API_KEY=… npm run eval -w @aifit/agents            # live evals (costs money)
AIFIT_AGENTS=1 ANTHROPIC_API_KEY=… npm run verify-catalog -w @aifit/agents -- --out verify-report
```

The weekly workflow `.github/workflows/verify-catalog.yml` runs on Mondays and
on demand. It skips with a notice if the `ANTHROPIC_API_KEY` repository secret
is missing. It uploads the report as an artifact and opens or updates one
`catalog-check` issue when something changed. A row reported as
"unverified" means the check could not confirm the fact either way; it is
not a pass. Pricing pages rendered by JavaScript will show up as
unverified, because the job fetches HTML and does not run scripts.

## Not built yet

These were proposed and are left for later, in this order:

1. Per-outcome specialists.
2. A blueprint reviewer.
3. A governance reviewer for the ARC Control export.
4. A regression agent.
5. A billing reconciler.
6. A release-QA agent.

Each one would need its own schema, deterministic check, evals and a row in
the inventory before it could be turned on.
