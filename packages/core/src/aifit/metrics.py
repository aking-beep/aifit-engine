from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence

from .config import ABSENCE_STRENGTH, EVENT_TO_METRICS, HIGH_CONFIDENCE_SCENARIO_COUNT, TARGET_OBSERVATIONS
from .models import AssessmentSession, MetricResult, UserFitVector


def score_metrics(
    session: AssessmentSession,
    scenario_dimensions: Mapping[str, Sequence[str]] | None = None,
) -> list[MetricResult]:
    """Average observed event strengths per metric.

    When ``scenario_dimensions`` maps scenario ids to the habits they test, a
    habit the user never showed in any completed scenario that tested it gets
    one ``ABSENCE_STRENGTH`` observation per such scenario. Habits the user did
    show are left as observed. Without the mapping, only positive signal counts.
    """
    values: dict[str, list[float]] = defaultdict(list)
    evidence: dict[str, list[str]] = defaultdict(list)
    scenarios: dict[str, set[str]] = defaultdict(set)

    for event in session.events:
        for metric in EVENT_TO_METRICS.get(event.event_type, ()):
            values[metric].append(event.strength)
            scenarios[metric].add(event.scenario_id)
            if event.evidence:
                evidence[metric].append(event.evidence)

    if scenario_dimensions:
        shown = set(values)
        completed = sorted({event.scenario_id for event in session.events if event.scenario_id})
        for scenario_id in completed:
            for metric in scenario_dimensions.get(scenario_id, ()):
                if metric in TARGET_OBSERVATIONS and metric not in shown:
                    values[metric].append(ABSENCE_STRENGTH)
                    scenarios[metric].add(scenario_id)

    results: list[MetricResult] = []
    for metric, observations in values.items():
        score = sum(observations) / len(observations)
        target = TARGET_OBSERVATIONS.get(metric, 4)
        observation_confidence = min(1.0, len(observations) / target)
        scenario_bonus = min(1.0, len(scenarios[metric]) / HIGH_CONFIDENCE_SCENARIO_COUNT)
        confidence = min(1.0, (observation_confidence * 0.7) + (scenario_bonus * 0.3))
        results.append(
            MetricResult(
                name=metric,
                score=round(score, 4),
                confidence=round(confidence, 4),
                observations=len(observations),
                scenario_ids=sorted(scenarios[metric]),
                evidence=evidence.get(metric, [])[:8],
            )
        )
    return sorted(results, key=lambda x: x.name)


def build_user_vector(metrics: list[MetricResult]) -> UserFitVector:
    return UserFitVector(
        values={m.name: m.score for m in metrics},
        confidence={m.name: m.confidence for m in metrics},
    )
