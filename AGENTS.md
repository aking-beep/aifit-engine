# AGENTS.md

You are building AI Fit Engine.

## Objective

Implement a trustworthy game-like assessment that recommends AI products, underlying models, workflows, and a portable working persona based on observed interaction behavior.

## Priority

1. Correct data models.
2. Deterministic scoring.
3. Explainability.
4. Registry separation.
5. Testability.
6. UI after the engine works.

## Do not

- Build a generic personality quiz.
- Use MBTI, Enneagram, IQ, clinical labels, or mental-health inference.
- Hard-code vendor winners into assessment code.
- Let one LLM call decide the result.
- Add agent frameworks unless clearly necessary.
- Scrape vendor data without provenance or freshness metadata.
- Mix product fit and model fit into one field.
- claim a psychological trait from a small interaction sample.

## Definition of a good result

A user should be able to inspect:

- what behavior the system observed
- what metric was produced
- how confident it is
- what product capability matched it
- why a specific product was recommended
- when the relevant product/model entry was last evaluated
