"""Product and data guardrails. Scoring stays deterministic; this file is the allow/deny list."""

from __future__ import annotations

from .models import InteractionEvent

MAX_FREE_TEXT_CHARS = 2_000
MAX_EVIDENCE_CHARS = 240
MAX_COMMENT_CHARS = 1_000
MAX_EVENTS_PER_BATCH = 24
MAX_EVENTS_PER_SESSION = 80
MAX_EXPORT_JSON_CHARS = 200_000

FORBIDDEN_LABELS = (
    "mbti",
    "enneagram",
    "iq",
    "diagnosis",
    "clinical",
    "personality type",
    "hiring score",
)

SAFETY = {
    "not_clinical": True,
    "not_hiring": True,
    "not_personality_test": True,
    "no_sensitive_attribute_inference": True,
    "llm_does_not_pick_winner": True,
    "scoring": "deterministic_server_side",
    "stores_name": False,
    "stores_employer": False,
}


def safety_payload() -> dict:
    return dict(SAFETY)


def clamp_text(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    return text if len(text) <= limit else text[:limit]


def scrub_event(event: InteractionEvent) -> InteractionEvent:
    """Drop raw notes after classification so free text is not persisted or shared."""
    return event.model_copy(
        update={
            "source_text": None,
            "evidence": clamp_text(event.evidence, MAX_EVIDENCE_CHARS),
        }
    )


def persona_contains_forbidden_label(persona: dict) -> bool:
    label = str(persona.get("label", "")).lower()
    traits = " ".join(str(item) for item in persona.get("traits", [])).lower()
    blob = f"{label} {traits}"
    return any(term in blob for term in ("mbti", "enneagram", "iq", "diagnosis", "clinical"))
