from __future__ import annotations

import json
import os
from datetime import date
from functools import lru_cache
from pathlib import Path

from .config import MODEL_WORKLOADS
from .adaptive import diagnostic_signal
from .classifier import classify_text
from .fit import build_stacks, rank_models_by_workload, rank_products
from .metrics import build_user_vector, score_metrics
from .models import AssessmentSession, FitFilters, InteractionEvent, ModelRecord, ProductRecord
from .persona import generate_persona
from .profile import (
    build_model_router,
    build_operating_stack,
    build_workflow,
    build_workstyle,
    default_instructions,
    install_guides,
    share_card_text,
)
from .freshness import freshness_report
from .registry import load_models, load_products, validate_models, validate_products


def repo_root() -> Path:
    env = os.environ.get("AIFIT_ROOT")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        if (parent / "data/registry/products.json").exists():
            return parent
    return here.parents[4]


def data_root(root: Path | None = None) -> Path:
    return (root or repo_root()) / "data"


RETENTION_DAYS = 30
PRIVACY_NOTICE = {
    "mode": "anonymous",
    "stores_name": False,
    "stores_employer": False,
    "retention": (
        f"Answers and notes are saved under a random session id for up to {RETENTION_DAYS} days, "
        "or until you delete the session. Deleting also removes share links made from it. "
        "Share snapshots contain scores only, not notes or raw answers."
    ),
}


@lru_cache(maxsize=8)
def _load_registry_cached(products_path: str, models_path: str, _stamp: tuple[float, float]):
    return tuple(load_products(products_path)), tuple(load_models(models_path))


def load_registry(root: Path | None = None) -> tuple[list[ProductRecord], list[ModelRecord]]:
    """Load the registry once per file version instead of on every score."""
    base = data_root(root)
    products_path = base / "registry/products.json"
    models_path = base / "registry/models.json"
    stamp = (products_path.stat().st_mtime, models_path.stat().st_mtime)
    products, models = _load_registry_cached(str(products_path), str(models_path), stamp)
    return list(products), list(models)


@lru_cache(maxsize=8)
def _scenario_dimensions_cached(path: str, _stamp: float) -> dict[str, tuple[str, ...]]:
    rows = json.loads(Path(path).read_text())
    return {row["id"]: tuple(row.get("dimensions") or ()) for row in rows}


def scenario_dimensions(root: Path | None = None) -> dict[str, tuple[str, ...]]:
    path = data_root(root) / "scenarios/scenarios.json"
    return _scenario_dimensions_cached(str(path), path.stat().st_mtime)


def score_session(
    session: AssessmentSession,
    *,
    root: Path | None = None,
    filters: FitFilters | None = None,
    products: list[ProductRecord] | None = None,
    models: list[ModelRecord] | None = None,
    as_of: date | None = None,
) -> dict:
    metrics = score_metrics(session, scenario_dimensions(root))
    user = build_user_vector(metrics)
    if products is None or models is None:
        loaded_products, loaded_models = load_registry(root)
        products = loaded_products if products is None else products
        models = loaded_models if models is None else models
    product_recs = rank_products(user, products, filters=filters, as_of=as_of)
    model_recs = rank_models_by_workload(models, as_of=as_of)
    primary, alternative = build_stacks(user, product_recs)
    persona = generate_persona(user)
    workstyle = build_workstyle(user, metrics)
    operating_stack = build_operating_stack(product_recs, user.values)
    payload = {
        "metrics": [m.model_dump() for m in metrics],
        "user_vector": user.model_dump(),
        "products": [x.model_dump() for x in product_recs[:12]],
        "products_by_category": _by_category(product_recs),
        "models": {w: [x.model_dump() for x in model_recs[w][:5]] for w in MODEL_WORKLOADS if model_recs[w]},
        "primary_stack": primary.model_dump(),
        "alternative_stack": alternative.model_dump(),
        "operating_stack": operating_stack,
        "model_routing": build_model_router(model_recs),
        "workflow": build_workflow(user.values),
        "workstyle": workstyle,
        "persona": persona,
        "instructions": default_instructions(persona),
        "install_guides": install_guides(),
        "diagnostic": diagnostic_signal(session),
        "freshness": freshness_report(products, models, as_of),
        "privacy": dict(PRIVACY_NOTICE),
        "disclaimer": "Fit scores are normalized similarity scores, not scientifically validated probabilities.",
    }
    payload["share_card"] = share_card_text(payload)
    return payload


def normalize_free_text(text: str, scenario_id: str, turn_id: str | None = None) -> list[InteractionEvent]:
    return classify_text(text, scenario_id, turn_id)


def registry_errors(root: Path | None = None) -> dict[str, list[str]]:
    products, models = load_registry(root)
    return {
        "products": validate_products(products),
        "models": validate_models(models),
    }


def _by_category(recs) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for rec in recs:
        key = rec.category or "other"
        grouped.setdefault(key, [])
        if len(grouped[key]) < 3:
            grouped[key].append(rec.model_dump())
    return grouped
