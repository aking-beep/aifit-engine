---
name: Registry evidence stale
about: Refresh dated evidence for a product or model row
labels: registry
---

**Record id:** `{product_or_model_id}`

Evidence date is older than 90 days, or the source is no longer canonical.

- [ ] Update `evidence_url` to a primary source
- [ ] Set `evidence_date` / `observed_at` to that source’s date (`YYYY-MM-DD`)
- [ ] Keep `evidence_notes` to one factual sentence
- [ ] Run `aifit freshness` and `aifit score examples/sample_session.json`

Do not invent claims or add affiliate links.
