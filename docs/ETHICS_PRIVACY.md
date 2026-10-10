# Ethics and Privacy

## Positioning

AI Fit Engine is a workflow preference and interaction recommendation system.

It is not:
- a clinical assessment
- a psychological diagnosis
- an intelligence test
- a hiring assessment
- an employment screening system

## Sensitive inference prohibition

Do not infer or score:
- race
- ethnicity
- religion
- political affiliation
- sexual orientation
- health/medical status
- disability
- criminal history
- other protected/sensitive characteristics

## Data minimization

Store only what is necessary for assessment and explanation.

For anonymous mode:
- generate a random session ID
- avoid requesting real name
- avoid requesting employer
- avoid requesting demographic attributes

## Explainability

The user should be able to see:
- what the system observed
- what it inferred about workflow preference
- which evidence contributed
- how to correct or delete the result

## Deletion and retention

- Answers and notes are stored server-side under a random session id for up to
  30 days, then expire. The browser keeps its own copy.
- `DELETE /v1/sessions/{id}` removes the session, its events and scores, and
  every share link made from it.
- `GET /v1/sessions/{id}/export` returns the stored record.
- Session calls need the session's token, so a leaked session id alone can't
  read or delete it.
- Share snapshots hold scores only: no notes, raw answers, per-metric evidence
  or user vector.
- No accounts.
- The optional LLM classifier (`AIFIT_LLM_CLASSIFIER=1`) sends note text to an
  operator-configured endpoint. It is off by default.

## Benchmark integrity

Do not rank vendors using unverified marketing claims alone.
Keep vendor evidence dated.
Separate official claims from independent evaluation.
