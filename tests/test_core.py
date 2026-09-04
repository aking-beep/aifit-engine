from pathlib import Path

from fastapi.testclient import TestClient

from aifit.engine import registry_errors, score_session
from aifit.events import classify_free_text
from aifit.exports import export_persona
from aifit.fit import rank_products
from aifit.metrics import build_user_vector, score_metrics
from aifit.models import AssessmentSession, FitFilters, ProductRecord
from aifit.persona import generate_persona
from aifit.scenarios import load_scenarios


def test_metrics_are_bounded():
    session = AssessmentSession(
        session_id="x",
        events=[{"event_type": "requested_evidence", "scenario_id": "s", "strength": 1.0}],
    )
    metrics = score_metrics(session)
    assert metrics
    assert all(0 <= x.score <= 1 for x in metrics)
    assert all(0 <= x.confidence <= 1 for x in metrics)


def test_product_ranking():
    session = AssessmentSession(
        session_id="x",
        events=[{"event_type": "requested_evidence", "scenario_id": "s", "strength": 1.0}],
    )
    user = build_user_vector(score_metrics(session))
    product = ProductRecord(
        id="p",
        name="P",
        provider="X",
        category="research",
        description="",
        fit_vector={"evidence_seeking": 1.0},
        last_evaluated_at="2026-09-03",
        registry_version="test",
        evidence=[{"source_type": "manual_eval", "title": "t", "observed_at": "2026-09-03"}],
    )
    ranked = rank_products(user, [product])
    assert ranked[0].id == "p"
    assert ranked[0].fit > 0.5
    assert ranked[0].positive_factors
    assert ranked[0].last_evaluated_at == "2026-09-03"


def test_capability_filter_excludes_unmatched_products():
    user = build_user_vector(
        score_metrics(
            AssessmentSession(
                session_id="x",
                events=[{"event_type": "requested_code", "scenario_id": "s", "strength": 1.0}],
            )
        )
    )
    keep = ProductRecord(
        id="keep",
        name="Keep",
        provider="X",
        category="ide",
        description="",
        capabilities=["coding"],
        fit_vector={"code_comfort": 1.0},
        last_evaluated_at="2026-09-03",
        registry_version="test",
        evidence=[{"source_type": "manual_eval", "title": "t", "observed_at": "2026-09-03"}],
    )
    drop = ProductRecord(
        id="drop",
        name="Drop",
        provider="X",
        category="writing",
        description="",
        capabilities=["writing"],
        fit_vector={"code_comfort": 1.0},
        last_evaluated_at="2026-09-03",
        registry_version="test",
        evidence=[{"source_type": "manual_eval", "title": "t", "observed_at": "2026-09-03"}],
    )
    ranked = rank_products(user, [keep, drop], filters=FitFilters(required_capabilities=["coding"]))
    assert [r.id for r in ranked] == ["keep"]


def test_free_text_classifier_preserves_source():
    events = classify_free_text("Compare the sources and cite evidence before you recommend.", "s", "1")
    types = {e.event_type for e in events}
    assert "requested_comparison" in types
    assert "requested_sources" in types
    assert all(e.source_text for e in events)


def test_persona_is_not_psychological():
    user = build_user_vector(
        score_metrics(
            AssessmentSession(
                session_id="x",
                events=[{"event_type": "requested_evidence", "scenario_id": "s", "strength": 1.0}],
            )
        )
    )
    persona = generate_persona(user)
    blob = " ".join(str(v) for v in persona.values()).lower()
    assert "mbti" not in blob
    assert "psychological" in persona["disclaimer"].lower() or "not psychological" in persona["disclaimer"].lower()
    assert persona["interaction_rules"]
    assert persona["decision_rules"] or persona["response_rules"]


def test_exports_cover_required_targets():
    persona = generate_persona(
        build_user_vector(
            score_metrics(
                AssessmentSession(
                    session_id="x",
                    events=[{"event_type": "requested_evidence", "scenario_id": "s", "strength": 1.0}],
                )
            )
        )
    )
    for target, filename in [
        ("generic", "persona.md"),
        ("claude", "CLAUDE.md"),
        ("agents", "AGENTS.md"),
        ("cursor", ".cursor/rules/ai-fit.mdc"),
        ("json", "ai-fit-profile.json"),
    ]:
        name, body = export_persona(persona, target)
        assert name == filename
        assert body


def test_sample_session_scores():
    session = AssessmentSession.model_validate_json(Path("examples/sample_session.json").read_text())
    result = score_session(session)
    assert result["metrics"]
    assert result["products"]
    assert result["models"]
    assert result["persona"]
    assert result["primary_stack"]["slots"]
    assert "disclaimer" in result


def test_eight_scenarios_have_multiple_opportunities():
    scenarios = load_scenarios()
    assert len(scenarios) == 8
    for scenario in scenarios:
        assert len(scenario.turns) >= 2
        for turn in scenario.turns:
            assert len(turn.choices) >= 2


def test_registry_valid():
    errors = registry_errors()
    assert errors["products"] == []
    assert errors["models"] == []


def test_api_health_and_score():
    from services.api.main import app

    client = TestClient(app)
    assert client.get("/health").json()["ok"] is True
    created = client.post("/v1/sessions").json()
    session_id = created["session_id"]
    add = client.post(
        f"/v1/sessions/{session_id}/events",
        json={
            "scenario_id": "launch-risk",
            "turn_id": "lr-1",
            "events": [{"event_type": "requested_evidence", "scenario_id": "launch-risk", "strength": 1.0}],
            "free_text": "cite sources",
        },
    )
    assert add.status_code == 200
    scored = client.post(f"/v1/sessions/{session_id}/score")
    assert scored.status_code == 200
    body = scored.json()
    assert body["products"]
    assert body["persona"]
    products = client.get("/v1/registry/products").json()
    models = client.get("/v1/registry/models").json()
    assert products and models
    assert all("last_evaluated_at" in p for p in products)
    exported = client.post("/v1/export/claude", json={"persona": body["persona"]})
    assert exported.status_code == 200
    assert "CLAUDE.md" in exported.json()["filename"]
    deleted = client.delete(f"/v1/sessions/{session_id}")
    assert deleted.json()["deleted"] is True
