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

### POST /v1/export/{target}
Returns an export artifact.

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
