# Registry seed review

The product and model JSON in `data/registry/` is an **illustrative seed**,
not a researched market survey.

Before treating any row as a public recommendation:

1. Confirm the product still exists and the URL is canonical.
2. Replace `evidence_url` with a dated primary source (docs, pricing, changelog).
3. Set `evidence_date` to that source’s date (`YYYY-MM-DD`).
4. Keep `evidence_notes` to one factual sentence.
5. Re-run `aifit freshness` and `aifit score`.

Until that review happens, the UI and README must say the catalog is seed data.
