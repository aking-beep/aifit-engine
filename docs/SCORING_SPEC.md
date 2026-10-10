# Scoring Specification

## Score range

All normalized preference and capability scores use `0.0 - 1.0`.

## User Fit Vector

Example:

```json
{
  "evidence_seeking": 0.88,
  "comparison_preference": 0.78,
  "iteration_preference": 0.91,
  "autonomy_preference": 0.62,
  "structure_preference": 0.84,
  "action_orientation": 0.89,
  "multimodal_preference": 0.52,
  "code_comfort": 0.77,
  "automation_appetite": 0.81,
  "local_control_preference": 0.30,
  "budget_sensitivity": 0.42
}
```

## Metric confidence

Confidence is separate from score.

A simple v0.1 confidence function:

```text
confidence = min(1.0, observations / target_observations)
```

Target observations default to 4 but may vary by metric.

## Absence of a habit

Events only record what a person did, so a habit they never showed would
otherwise be missing from the vector and never count against a product.
When a completed scenario tests a habit (its `dimensions`) and the person never
showed that habit in any scenario, the habit gets one observation at
`ABSENCE_STRENGTH` (0.2) per such scenario. Habits the person did show keep
their observed average. The adaptive stopping rule still uses positive signal
only.

## Product fit

Each product entry has a fit vector using the same compatible dimensions plus capability flags.

Initial fit calculation:

```text
weighted_distance = Σ weight[d] * abs(user[d] - product_preference_fit[d])   (d measured for the user)
base_fit = 1 - weighted_distance / Σ weights over measured d
coverage = Σ weights over measured d / Σ weights over all of the product's d
fit = base_fit * freshness * (0.7 + 0.3 * mean_confidence) * (0.6 + 0.4 * coverage)
```

Coverage stops a product matched on one dimension from outranking one matched
on six. Every constant here lives in `aifit/config.py`.

Then apply:
- capability requirement filters
- category relevance
- budget constraint
- local/cloud requirement
- technical-level compatibility
- confidence penalty
- freshness penalty

## Freshness penalty

Registry records older than a configured threshold (`FRESHNESS_THRESHOLD_DAYS`,
30) should lose confidence, not automatically become "bad." Anything past the
threshold is listed in the freshness report's `needs_review`. Scoring takes an
optional `as_of` date so tests and evals don't drift with the calendar; the eval
harness defaults it to the newest registry date.

Example:
- <= 30 days: 1.00
- 31-90 days: 0.95
- 91-180 days: 0.85
- >180 days: 0.70

## Model fit

Model fit is workload-specific.

A user does not receive one globally "best model."

Example:

```json
{
  "deep_reasoning": [{"model":"...", "fit":0.91}],
  "coding": [{"model":"...", "fit":0.93}],
  "multimodal": [{"model":"...", "fit":0.88}]
}
```

## Explainability

Every recommendation must expose:
- base fit
- strongest positive factors
- strongest negative factors
- relevant user metrics
- registry freshness
- confidence
- capability requirements satisfied

## Prevent bogus precision

UI may show whole-number percentages for readability, but internal documentation must clearly say the score is a normalized fit score, not a scientifically validated probability.
