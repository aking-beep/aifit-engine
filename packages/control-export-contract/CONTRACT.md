# GovernanceExport v1 — AI Fit Teams → ARC Control (proposed)

**Status: proposed.** AI Fit does not assume ARC Control implements any endpoint for this
contract. Releases of AI Fit never depend on it. (The existing calibration read uses the
`ARK_CONTROL_URL` / `ARK_CONTROL_TOKEN` environment variables; those names predate the ARC Control
name and are kept for compatibility.)

## What it is

A JSON document produced from **one** saved AI Fit Teams assessment, carrying:

| Section | Contents | Derived from |
|---|---|---|
| `governanceRequirements` | Controls the workload needs before launch, with a verification method. `severity` is `blocking` or `recommended`. | Teams security rubric, decision hard constraints, evaluation plan |
| `policySuggestions` | Machine-readable policy rules Control *could* adopt: human approval for named actions, redaction / denial of data classes, spend and turn caps, residency, tool allow-lists. `status` is always `suggested`. | Workload actions, data classes, architecture call shape, cost estimate |
| `agentInventory` | Whether the workload should be registered as an agent, and its tools, autonomy, data classes and model. `owner` is always `null`: the customer assigns it. | Architecture pattern, actions |
| `evaluationEvidence` | The evaluation **plan** (acceptance criteria, golden-set size). `observed` is always empty and `status` is never "passed": AI Fit runs no evaluations. | Teams evaluation plan |

## What it is not

- **Not enforced controls.** `enforcement` is the literal `"recommended-not-enforced"`. A consumer
  must treat every item as a proposal awaiting a human decision.
- **Not evidence of compliance.** Verification `owner` is always `"customer"`.
- **Not a measurement.** Cost-derived suggestions (spend caps) carry their `basis`; with no
  telemetry that is `heuristic`.

## Delivery

1. **File (default, always available).** `GET /api/assessments/{id}/control-export` in AI Fit Teams
   returns `governance-export.json` for download and manual import.
2. **HTTP (optional, off by default).** When `CONTROL_EXPORT_URL` is set, Teams can `POST` the
   document:

   ```http
   POST {CONTROL_EXPORT_URL}
   content-type: application/vnd.aifit.governance-export+json; version=1
   authorization: Bearer {CONTROL_EXPORT_TOKEN}
   idempotency-key: {sha256 of the canonical document}
   ```

   Proposed responses: `202` accepted for review, `409` already received (same idempotency key),
   `422` contract mismatch. Any other answer is reported to the user as "not delivered"; the file
   download remains the fallback.

## Versioning

`contract` + `version` identify the shape. Additive, optional fields bump the minor version;
anything else bumps the major. `governance-export.schema.json` (JSON Schema 2020-12) and
`src/index.ts` (zod) must agree; `src/contract.test.ts` checks the required keys and literals.
