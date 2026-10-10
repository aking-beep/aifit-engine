"""Registry freshness reporting. Old records lose confidence, not capability."""

from __future__ import annotations

from datetime import date

from .config import FRESHNESS_BANDS, FRESHNESS_FLOOR_BAND, FRESHNESS_THRESHOLD_DAYS
from .fit import _freshness_factor, record_age_days
from .models import ModelRecord, ProductRecord


def describe_age(last_evaluated_at: str, as_of: date | None = None) -> dict:
    age = record_age_days(last_evaluated_at, as_of)
    factor = _freshness_factor(last_evaluated_at, as_of)
    if age is None:
        band = "unknown"
    else:
        band = next((name for max_age, _f, name in FRESHNESS_BANDS if age <= max_age), FRESHNESS_FLOOR_BAND)
    return {"last_evaluated_at": last_evaluated_at, "age_days": age, "factor": factor, "band": band}


def freshness_report(products: list[ProductRecord], models: list[ModelRecord], as_of: date | None = None) -> dict:
    product_rows = [
        {"id": p.id, "name": p.name, "category": p.category, **describe_age(p.last_evaluated_at, as_of)}
        for p in products
    ]
    model_rows = [
        {"id": m.id, "name": m.name, "family": m.family, **describe_age(m.last_evaluated_at, as_of)}
        for m in models
    ]
    needs_review = [
        r
        for r in product_rows + model_rows
        if r["age_days"] is None or r["age_days"] > FRESHNESS_THRESHOLD_DAYS
    ]
    return {
        "products": product_rows,
        "models": model_rows,
        "needs_review": needs_review,
        "threshold_days": FRESHNESS_THRESHOLD_DAYS,
        "policy": (
            f"Records older than {FRESHNESS_THRESHOLD_DAYS} days need review. "
            "They lose confidence rather than being marked as bad."
        ),
    }
