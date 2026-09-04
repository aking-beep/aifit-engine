# Evaluations

This directory stores dated evaluations of products and models.

```text
evals/
  harness.py
  cases/
    coding/
    research/
    multimodal/
    agentic/
  runs/
    YYYY-MM-DD-provider-target/
      run.json
  rubrics/
```

Each run records provider, product/model, exact version, date, settings, evaluator, raw outputs, rubric scores, human review, and notes.

Do not silently convert benchmark results into registry updates. Use:

```bash
PYTHONPATH=packages/core/src python -m evals.harness validate-seed
PYTHONPATH=packages/core/src python -m evals.harness init-run anthropic claude-fable-5-1 coding
```
