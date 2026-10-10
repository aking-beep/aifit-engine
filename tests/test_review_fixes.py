from __future__ import annotations

import os
import time
from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from aifit.config import ABSENCE_STRENGTH, FRESHNESS_THRESHOLD_DAYS
from aifit.engine import scenario_dimensions, score_session
from aifit.fit import rank_products
from aifit.freshness import freshness_report
from aifit.metrics import score_metrics
from aifit.models import AssessmentSession, UserFitVector
from aifit.registry import load_models, load_products
from services.api.store import ResultStore

EVIDENCE = {"event_type": "requested_evidence", "scenario_id": "launch-risk", "strength": 1.0}


def _client() -> TestClient:
    from services.api.main import app

    return TestClient(app)


def _session(client: TestClient) -> tuple[str, dict[str, str]]:
    created = client.post("/v1/sessions").json()
    return created["session_id"], {"X-Session-Token": created["token"]}


def test_stateless_score_counts_notes_and_stores_nothing():
    client = _client()
    without = client.post("/v1/score", json={"events": [EVIDENCE]}).json()
    with_notes = client.post(
        "/v1/score",
        json={
            "events": [EVIDENCE],
            "notes": [{"text": "please compare the options side by side", "scenario_id": "launch-risk", "turn_id": "lr-1"}],
        },
    ).json()
    names = {m["name"] for m in with_notes["metrics"]}
    assert "comparison_preference" in names
    assert "comparison_preference" not in {m["name"] for m in without["metrics"]}


def test_session_endpoints_require_token():
    client = _client()
    session_id, auth = _session(client)
    assert client.post(f"/v1/sessions/{session_id}/events", json={"events": [EVIDENCE]}).status_code == 403
    assert client.get(f"/v1/sessions/{session_id}/export").status_code == 403
    assert client.delete(f"/v1/sessions/{session_id}", headers={"X-Session-Token": "wrong"}).status_code == 403
    assert client.get(f"/v1/sessions/{session_id}", headers=auth).status_code == 200


def test_session_ids_must_be_uuids_and_batches_are_bounded():
    client = _client()
    assert client.post("/v1/sessions/not-a-uuid/events", json={"events": []}).status_code == 422
    session_id, auth = _session(client)
    too_many = {"events": [EVIDENCE] * 51}
    assert client.post(f"/v1/sessions/{session_id}/events", headers=auth, json=too_many).status_code == 422
    long_note = {"events": [], "free_text": "x" * 2001, "scenario_id": "launch-risk"}
    assert client.post(f"/v1/sessions/{session_id}/events", headers=auth, json=long_note).status_code == 422


def test_unknown_uuid_session_is_adopted_with_callers_token():
    import uuid

    client = _client()
    session_id = str(uuid.uuid4())
    auth = {"X-Session-Token": "client-generated-token"}
    assert client.post(f"/v1/sessions/{session_id}/events", headers=auth, json={"events": [EVIDENCE]}).status_code == 200
    assert client.post(f"/v1/sessions/{session_id}/events", json={"events": [EVIDENCE]}).status_code == 403
    assert client.get(f"/v1/sessions/{session_id}", headers=auth).json()["session"]["events"]


def test_share_validates_input_and_strips_evidence():
    client = _client()
    assert client.post("/v1/share", json={"result": {"persona": {"label": "x"}}}).status_code == 200
    assert client.post("/v1/share", json={"result": {"persona": "x"}}).status_code == 400
    demo = client.post("/v1/sessions/demo").json()
    share_id = client.post("/v1/share", json={"result": demo["result"]}).json()["share_id"]
    snapshot = client.get(f"/v1/share/{share_id}").json()
    assert snapshot["metrics"]
    assert all("evidence" not in m for m in snapshot["metrics"])
    assert all(not row.get("evidence") for row in snapshot["workstyle"]["why"])
    assert "user_vector" not in snapshot


def test_delete_removes_linked_shares():
    client = _client()
    demo = client.post("/v1/sessions/demo").json()
    session_id, auth = demo["session_id"], {"X-Session-Token": demo["token"]}
    from_session = client.post(f"/v1/sessions/{session_id}/share", headers=auth).json()["share_id"]
    linked = client.post(
        "/v1/share", headers=auth, json={"result": demo["result"], "session_id": session_id}
    ).json()["share_id"]
    assert client.delete(f"/v1/sessions/{session_id}", headers=auth).status_code == 200
    assert client.get(f"/v1/share/{from_session}").status_code == 404
    assert client.get(f"/v1/share/{linked}").status_code == 404
    assert client.get(f"/v1/sessions/{session_id}", headers=auth).status_code == 404


def test_export_rejects_malformed_results():
    client = _client()
    assert client.post("/v1/export/profile", json={"result": {"persona": "str"}}).status_code == 400


def test_store_reads_are_not_cached_per_instance(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("AIFIT_STORE", str(tmp_path))
    first, second = ResultStore(), ResultStore()
    first.put("sessions", "abc", {"v": 1})
    assert second.get("sessions", "abc") == {"v": 1}
    second.put("sessions", "abc", {"v": 2})
    assert first.get("sessions", "abc") == {"v": 2}
    first.append("events", "abc", [{"n": 1}])
    second.append("events", "abc", [{"n": 2}])
    assert [row["n"] for row in first.get_list("events", "abc")] == [1, 2]


def test_store_expires_old_files_and_rejects_bad_keys(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("AIFIT_STORE", str(tmp_path))
    store = ResultStore()
    store.put("shares", "old", {"v": 1})
    stale = time.time() - store.ttl - 60
    os.utime(tmp_path / "shares" / "old.json", (stale, stale))
    assert store.get("shares", "old") is None
    try:
        store.get("shares", "../etc")
    except ValueError:
        pass
    else:
        raise AssertionError("path-like keys must be rejected")


def test_single_matching_dimension_does_not_beat_broad_match():
    products = load_products(Path("data/registry/products.json"))
    narrow = rank_products(UserFitVector(values={"evidence_seeking": 0.9}, confidence={"evidence_seeking": 1}), products)
    assert narrow[0].coverage is not None and narrow[0].coverage < 1
    assert narrow[0].fit < 0.9


def test_never_shown_habit_scores_low_instead_of_being_ignored():
    session = AssessmentSession(session_id="x", events=[EVIDENCE])
    metrics = {m.name: m for m in score_metrics(session, scenario_dimensions())}
    assert metrics["clarification_tendency"].score == ABSENCE_STRENGTH
    assert metrics["evidence_seeking"].score == 1.0
    positive_only = {m.name for m in score_metrics(session)}
    assert "clarification_tendency" not in positive_only


def test_scoring_is_deterministic_for_a_fixed_date():
    session = AssessmentSession.model_validate_json(Path("examples/sample_session.json").read_text())
    day = date(2026, 9, 12)
    first = score_session(session, as_of=day)
    later = score_session(session, as_of=day)
    assert first["products"] == later["products"]
    aged = score_session(session, as_of=day + timedelta(days=200))
    assert aged["products"][0]["freshness"] < first["products"][0]["freshness"]


def test_freshness_report_flags_records_past_threshold():
    products = load_products(Path("data/registry/products.json"))
    models = load_models(Path("data/registry/models.json"))
    newest = max(date.fromisoformat(p.last_evaluated_at) for p in products)
    fresh = freshness_report(products, models, as_of=newest)
    assert fresh["needs_review"] == []
    aging = freshness_report(products, models, as_of=newest + timedelta(days=FRESHNESS_THRESHOLD_DAYS + 1))
    assert {row["band"] for row in aging["needs_review"]} == {"aging"}
