"""Centralized scoring weights and thresholds."""

from __future__ import annotations

DEFAULT_WEIGHTS: dict[str, float] = {
    "evidence_seeking": 1.0,
    "comparison_preference": 0.9,
    "iteration_preference": 1.0,
    "autonomy_preference": 1.0,
    "structure_preference": 0.8,
    "action_orientation": 0.9,
    "multimodal_preference": 0.8,
    "code_comfort": 1.0,
    "automation_appetite": 0.9,
    "integration_appetite": 0.8,
    "local_control_preference": 1.0,
    "budget_sensitivity": 0.8,
}

TARGET_OBSERVATIONS: dict[str, int] = {
    "clarification_tendency": 4,
    "evidence_seeking": 4,
    "comparison_preference": 4,
    "alternative_seeking": 4,
    "assumption_challenge": 4,
    "iteration_preference": 5,
    "recommendation_preference": 4,
    "autonomy_preference": 4,
    "structure_preference": 4,
    "conciseness_preference": 4,
    "action_orientation": 4,
    "multimodal_preference": 4,
    "code_comfort": 3,
    "automation_appetite": 3,
    "integration_appetite": 3,
    "speed_preference": 3,
    "depth_preference": 3,
    "local_control_preference": 3,
    "cloud_preference": 3,
    "budget_sensitivity": 3,
    "quality_preference": 3,
}

EVENT_TO_METRICS: dict[str, tuple[str, ...]] = {
    "asked_clarification": ("clarification_tendency",),
    "requested_evidence": ("evidence_seeking",),
    "requested_sources": ("evidence_seeking",),
    "requested_comparison": ("comparison_preference",),
    "requested_alternative": ("alternative_seeking",),
    "challenged_assumption": ("assumption_challenge",),
    "changed_constraint": ("iteration_preference",),
    "corrected_output": ("iteration_preference",),
    "requested_recommendation": ("recommendation_preference", "action_orientation"),
    "delegated_action": ("autonomy_preference", "action_orientation"),
    "requested_step_by_step": ("structure_preference",),
    "requested_summary": ("conciseness_preference",),
    "requested_visual": ("multimodal_preference",),
    "requested_code": ("code_comfort",),
    "requested_automation": ("automation_appetite",),
    "requested_integration": ("integration_appetite",),
    "chose_fast_path": ("speed_preference",),
    "chose_deep_path": ("depth_preference",),
    "chose_local_control": ("local_control_preference",),
    "chose_cloud_service": ("cloud_preference",),
    "chose_lower_cost": ("budget_sensitivity",),
    "chose_best_quality": ("quality_preference",),
}

PRICING_RANK = {
    "free": 0,
    "low": 1,
    "mixed": 2,
    "unknown": 2,
    "high": 3,
}

FRESHNESS_THRESHOLD_DAYS = 30
HIGH_CONFIDENCE_SCENARIO_COUNT = 2

# Registry age bands: (max age in days, confidence factor, band name). Records
# older than the last band get FRESHNESS_FLOOR_FACTOR. The first band ends at
# FRESHNESS_THRESHOLD_DAYS; anything past it needs review.
FRESHNESS_BANDS: tuple[tuple[int, float, str], ...] = (
    (FRESHNESS_THRESHOLD_DAYS, 1.0, "current"),
    (90, 0.95, "aging"),
    (180, 0.85, "stale"),
)
FRESHNESS_FLOOR_FACTOR = 0.70
FRESHNESS_FLOOR_BAND = "expired_confidence"
FRESHNESS_UNKNOWN_FACTOR = 0.70

# Product fit = base_fit * freshness * (CONFIDENCE_FLOOR + CONFIDENCE_SPAN * mean_conf)
#             * (COVERAGE_FLOOR + (1 - COVERAGE_FLOOR) * coverage)
# coverage is the share of a product's weighted dimensions the user was
# actually measured on, so one matching dimension cannot beat six.
CONFIDENCE_FLOOR = 0.7
CONFIDENCE_SPAN = 0.3
DEFAULT_DIMENSION_CONFIDENCE = 0.5
COVERAGE_FLOOR = 0.6
NEGATIVE_FACTOR_DISTANCE = 0.35

# A habit the user never showed in any scenario that tested it counts as one
# weak observation per such scenario, so absence lowers fit instead of being
# ignored.
ABSENCE_STRENGTH = 0.2

# Thresholds on the user vector that pull a category into the stack.
CATEGORY_THRESHOLDS: dict[str, float] = {
    "code_comfort": 0.45,
    "evidence_seeking": 0.55,
    "automation_appetite": 0.55,
    "integration_appetite": 0.55,
    "multimodal_preference": 0.55,
    "data_analysis_structure": 0.65,
    "data_analysis_evidence": 0.5,
    "local_control_preference": 0.6,
}

# Adaptive quiz stopping rule.
ADAPTIVE_MIN_SCENARIOS = 4
ADAPTIVE_MAX_SCENARIOS = 8
ADAPTIVE_READY_CONFIDENCE = 0.42
ADAPTIVE_MIN_CORE_METRICS = 4
ADAPTIVE_CORE_METRICS = (
    "evidence_seeking",
    "assumption_challenge",
    "iteration_preference",
    "autonomy_preference",
    "comparison_preference",
)
MODEL_WORKLOADS = (
    "deep_reasoning",
    "fast_reasoning",
    "coding",
    "long_context",
    "multimodal",
    "research",
    "agentic_execution",
    "cost_efficiency",
    "local_control",
)
