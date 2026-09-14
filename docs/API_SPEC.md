# API Specification

## MVP endpoints

### GET /health
Basic health.

### GET /v1/scenarios
Returns active assessment scenarios.

### POST /v1/sessions
Creates an assessment session.

### POST /v1/sessions/{id}/events
Adds normalized/raw interaction events.

### POST /v1/sessions/{id}/score
Scores current session.

### GET /v1/registry/products
Lists product registry.

### GET /v1/registry/models
Lists model registry.

### POST /v1/fit
Accepts a user fit vector and returns ranked products/models.

### POST /v1/persona
Generates a portable persona payload from metrics.

### POST /v1/sessions/demo
Loads the sample session, scores it, and returns `{session_id, result}`.

### POST /v1/sessions/{id}/share
Stores an anonymous score snapshot (no raw prompts).

### GET /v1/share/{share_id}
Returns that snapshot.

### GET /v1/sessions/{id}/export
Exports the anonymous session record.

### DELETE /v1/sessions/{id}
Deletes in-memory events and scores.

### POST /v1/classify
Keyword (and optional LLM) event labels. Not a recommendation.

### GET /v1/registry/freshness
Age bands. Stale rows lose confidence.

### POST /v1/feedback
1–5 rating and optional comment. No identity fields.

### GET /v1/analytics/summary
Anonymous in-memory event counts.

### GET /v1/access
Launch-gate status: `{ mode: "off" | "waitlist" | "code", note }`. Default `off`. Does not return codes.

### POST /v1/access/unlock
`{ code }`. 200 when `FIT_ACCESS_GATE=code` and the code is in `FIT_ACCESS_CODES`. 403 otherwise. 404 when codes are not in use.

### POST /v1/waitlist
`{ email, source? }`. 200 when the waitlist or code gate is on. Stores email + timestamp. 404 when the public quiz is ungated.

### GET /v1/waitlist
`{ count }` publicly. Redacted `recent` rows only when `X-Fit-Operator-Key` matches `FIT_OPERATOR_KEY`.


## Response requirement

Recommendation objects must include:

```json
{
  "id": "...",
  "name": "...",
  "fit": 0.87,
  "confidence": 0.82,
  "positive_factors": [],
  "negative_factors": [],
  "last_evaluated_at": "..."
}
```
