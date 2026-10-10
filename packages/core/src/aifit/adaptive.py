"""Stop the diagnostic once there is enough interaction signal."""

from __future__ import annotations

from .config import (
    ADAPTIVE_CORE_METRICS as CORE_METRICS,
    ADAPTIVE_MAX_SCENARIOS as MAX_SCENARIOS,
    ADAPTIVE_MIN_CORE_METRICS,
    ADAPTIVE_MIN_SCENARIOS as MIN_SCENARIOS,
    ADAPTIVE_READY_CONFIDENCE as READY_CONFIDENCE,
)
from .metrics import build_user_vector, score_metrics
from .models import AssessmentSession


def diagnostic_signal(session: AssessmentSession) -> dict:
    metrics = score_metrics(session)
    user = build_user_vector(metrics)
    completed = sorted({event.scenario_id for event in session.events if event.scenario_id})
    n = len(completed)
    present = [key for key in CORE_METRICS if key in user.values]
    confs = [user.confidence.get(key, 0.0) for key in present]
    mean_conf = sum(confs) / len(confs) if confs else 0.0
    ready = n >= MAX_SCENARIOS or (
        n >= MIN_SCENARIOS and len(present) >= ADAPTIVE_MIN_CORE_METRICS and mean_conf >= READY_CONFIDENCE
    )
    nxt = None if ready else _next_scenario_id(completed, user.confidence)
    return {
        "ready": ready,
        "scenarios_completed": n,
        "min_scenarios": MIN_SCENARIOS,
        "max_scenarios": MAX_SCENARIOS,
        "confidence": round(mean_conf, 4),
        "covered_core": present,
        "next_scenario_id": nxt,
        "note": (
            "Enough signal to score this style."
            if ready and n < MAX_SCENARIOS
            else "Need another scene to cover a weaker habit."
            if not ready
            else "Reached the quiz cap."
        ),
    }


def _next_scenario_id(completed: list[str], confidence: dict[str, float]) -> str | None:
    from .scenarios import load_scenarios

    remaining = [scenario for scenario in load_scenarios() if scenario.id not in completed]
    if not remaining:
        return None
    weakest = min(CORE_METRICS, key=lambda key: confidence.get(key, 0.0))
    for scenario in remaining:
        if weakest in scenario.dimensions:
            return scenario.id
    return remaining[0].id
