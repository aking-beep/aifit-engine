from fastapi.testclient import TestClient

from aifit.guardrails import persona_contains_forbidden_label, safety_payload, scrub_event
from aifit.models import InteractionEvent
from services.api.limits import LIMITER


def test_safety_payload_is_explicit() -> None:
    safety = safety_payload()
    assert safety["not_clinical"] is True
    assert safety["not_hiring"] is True
    assert safety["llm_does_not_pick_winner"] is True
    assert safety["no_sensitive_attribute_inference"] is True


def test_scrub_event_drops_source_text() -> None:
    event = InteractionEvent(
        event_type="requested_evidence",
        scenario_id="s",
        source_text="My name is Alex and my employer is Example Co",
        evidence="Free-text matched requested evidence.",
    )
    cleaned = scrub_event(event)
    assert cleaned.source_text is None
    assert "Alex" not in (cleaned.evidence or "")


def test_persona_guard_skips_clinical_style_labels() -> None:
    from aifit.engine import score_session
    from aifit.models import AssessmentSession

    result = score_session(
        AssessmentSession(
            session_id="x",
            events=[{"event_type": "requested_evidence", "scenario_id": "s", "strength": 1.0}],
        )
    )
    assert result["safety"]["not_personality_test"] is True
    assert persona_contains_forbidden_label(result["persona"]) is False
    blob = str(result["persona"]).lower()
    assert "mbti" not in blob
    assert "enneagram" not in blob


def test_api_drops_notes_and_hides_waitlist_emails(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FIT_WAITLIST_PATH", str(tmp_path / "waitlist.jsonl"))
    monkeypatch.setenv("FIT_ACCESS_GATE", "waitlist")
    monkeypatch.setenv("FIT_OPERATOR_KEY", "op-secret")
    LIMITER.reset()
    from services.api.main import app

    client = TestClient(app)
    created = client.post("/v1/sessions").json()["session_id"]
    added = client.post(
        f"/v1/sessions/{created}/events",
        json={
            "scenario_id": "launch-risk",
            "turn_id": "lr-1",
            "events": [
                {
                    "event_type": "requested_evidence",
                    "scenario_id": "launch-risk",
                    "strength": 1.0,
                    "source_text": "ssn 111-22-3333",
                }
            ],
            "free_text": "cite sources please, my email is secret@example.com",
        },
    )
    assert added.status_code == 200
    stored = client.get(f"/v1/sessions/{created}").json()["session"]["events"]
    assert stored
    assert all(row.get("source_text") in (None, "") for row in stored)
    assert "secret@example.com" not in str(stored)
    assert "111-22-3333" not in str(stored)

    client.post("/v1/waitlist", json={"email": "founder@example.com"})
    public = client.get("/v1/waitlist")
    assert public.status_code == 200
    assert public.json()["count"] == 1
    assert "recent" not in public.json()
    assert "founder@example.com" not in public.text
    private = client.get("/v1/waitlist", headers={"x-fit-operator-key": "op-secret"})
    assert private.json()["recent"][0]["email"].startswith("f***@")
    health = client.get("/health")
    assert health.json()["guardrails"] is True
    assert health.headers.get("x-content-type-options") == "nosniff"
    assert health.headers.get("x-frame-options") == "DENY"


def test_rate_limit_returns_429(monkeypatch) -> None:
    monkeypatch.setenv("FIT_RATE_LIMIT_PER_MINUTE", "2")
    LIMITER.reset()
    from services.api.main import app

    client = TestClient(app)
    assert client.get("/v1/scenarios").status_code == 200
    assert client.get("/v1/scenarios").status_code == 200
    blocked = client.get("/v1/scenarios")
    assert blocked.status_code == 429
    LIMITER.reset()


def test_oversized_note_is_rejected() -> None:
    LIMITER.reset()
    from services.api.main import app

    client = TestClient(app)
    session_id = client.post("/v1/sessions").json()["session_id"]
    rejected = client.post(
        f"/v1/sessions/{session_id}/events",
        json={"scenario_id": "launch-risk", "turn_id": "lr-1", "events": [], "free_text": "x" * 2001},
    )
    assert rejected.status_code == 422