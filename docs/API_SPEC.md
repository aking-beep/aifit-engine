# API Specification

## Sessions and tokens

Session ids are random UUIDs. `POST /v1/sessions` (and `/v1/sessions/demo`)
returns a `token` once. Every session-scoped call (`GET /v1/sessions/{id}`,
`POST .../events`, `POST .../score`, `POST .../share`, `GET .../export`,
`DELETE /v1/sessions/{id}`, and `POST /v1/share` with a `session_id`) must send
it as the `X-Session-Token` header, or gets 403. Only a hash of the token is
stored. If `POST .../events` names a UUID the server doesn't know (another
serverless instance, or a client that couldn't reach create), the session is
created with the caller's token.

Events are stored in an append-only list, so concurrent saves from separate
instances don't overwrite each other. Records expire after 30 days.

Limits: request bodies 512 KB, 50 events per batch, 1000 events per session,
notes and free text 2000 characters, share snapshots 256 KB.

## MVP endpoints

### GET /health
Basic health.

### GET /v1/scenarios
Returns active assessment scenarios.

### POST /v1/sessions
Creates an assessment session.

### POST /v1/sessions/{id}/events
Adds normalized/raw interaction events. Optional `free_text` is classified into events.

### POST /v1/sessions/{id}/score
Scores the stored session (choices and notes) and stores the result.

### POST /v1/score
Stateless: scores `events` plus optional `notes` (`[{text, scenario_id, turn_id}]`,
classified server-side) with optional `filters`. Stores nothing.

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
Stores an anonymous score snapshot: no raw answers, notes, per-metric evidence or user vector.

### POST /v1/share
Stores a snapshot of a supplied result. Pass `session_id` (with its token) to
link it, so deleting the session deletes the share.

### GET /v1/share/{share_id}
Returns that snapshot.

### GET /v1/sessions/{id}/export
Exports the anonymous session record.

### DELETE /v1/sessions/{id}
Deletes the session, its events and scores, and every share linked to it.

### POST /v1/classify
Keyword (and optional LLM) event labels. Not a recommendation.

### GET /v1/registry/freshness
Age bands. Stale rows lose confidence.

### POST /v1/feedback
1–5 rating and optional comment. No identity fields. Stored for 30 days.

### GET /v1/analytics/summary
Anonymous in-process event counts, plus the stored feedback count.


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
  "last_evaluated_at": "...",
  "coverage": 0.83
}
```
