# Contributing

AI Fit Engine measures observable AI interaction and maps it to a dated product/model registry.

## Welcome

- registry records with dated evidence
- public benchmark results (human-reviewed)
- scenario packs
- export adapters

## Not accepted

- unsupported vendor claims
- affiliate links inside registry data
- psychological profiling labels
- hiring / screening features
- opaque LLM ranking

## Local checks

```bash
pip install -e ".[dev]"
pytest
python -m evals.harness validate-seed
python -m evals.harness run-cases
```
