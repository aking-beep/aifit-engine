"""The downloadable setup bundle: format validation, secret redaction, manifest."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from aifit.bundle import BundleValidationError, build_bundle, find_secrets, redact_secrets, validate_file
from aifit.engine import score_session
from aifit.models import AssessmentSession
from aifit.registry import load_models, load_products
from services.api.main import app

ROOT = Path(__file__).resolve().parents[1]
FAKE_KEYS = [
    "sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345",
    "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789",
    "sk_test_51Habcdefghijklmnop1234",
    "whsec_abcdefghijklmnopqrstu",
    "AKIAABCDEFGHIJKLMNOP",
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "xoxb-1234567890-abcdefghij",
    "password = hunter2hunter2hunter2",
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----",
]


@pytest.fixture(scope="module")
def result() -> dict:
    session = AssessmentSession.model_validate(json.loads((ROOT / "examples/sample_session.json").read_text()))
    return score_session(
        session,
        products=load_products(ROOT / "data/registry/products.json"),
        models=load_models(ROOT / "data/registry/models.json"),
    )


def _unzip(blob: bytes) -> dict[str, str]:
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        return {name: z.read(name).decode("utf-8") for name in z.namelist()}


@pytest.mark.parametrize("key", FAKE_KEYS)
def test_each_secret_pattern_is_found_and_redacted(key):
    text = f"My note: {key} please"
    assert find_secrets(text)
    clean, n = redact_secrets(text)
    assert n >= 1
    assert not find_secrets(clean)


def test_ordinary_prose_is_not_redacted():
    text = "I like to skim summaries first, then ask for sources. My token budget is small."
    assert redact_secrets(text) == (text, 0)


def test_bundle_contents_are_validated_and_listed_in_the_manifest(result):
    filename, blob, manifest = build_bundle(result)
    files = _unzip(blob)
    assert filename == "ai-profile.zip"
    expected = {
        "README.md", "PROFILE.md", "CLAUDE.md", "AGENTS.md", ".cursor/rules/fit.mdc", "chatgpt-instructions.md",
        "gemini-instructions.md", "model-routing.json", "workflows/everyday-loop.md", "manifest.json",
        "prompts/draft.md", "prompts/summarize.md", "prompts/research.md", "prompts/review.md", "prompts/decide.md",
    }
    assert {name.removeprefix("ai-profile/") for name in files} == expected
    assert json.loads(files["ai-profile/manifest.json"]) == manifest
    for entry in manifest["files"]:
        body = files[f"ai-profile/{entry['path']}"]
        assert hashlib.sha256(body.encode()).hexdigest() == entry["sha256"]
        assert all(c["passed"] for c in validate_file(entry["path"], body))
    json.loads(files["ai-profile/model-routing.json"])
    assert files["ai-profile/.cursor/rules/fit.mdc"].startswith("---\ndescription:")
    assert manifest["validation"]["status"] == "format_checks_passed"


def test_secrets_in_notes_never_reach_the_bundle(result):
    poisoned = json.loads(json.dumps(result))
    poisoned["persona"]["interaction_rules"] = [f"Use my key {k}" for k in FAKE_KEYS[:4]] + poisoned["persona"].get(
        "interaction_rules", []
    )
    reasons = (poisoned.get("workstyle") or {}).get("why") or []
    if reasons:
        reasons[0].setdefault("evidence", []).append("my AWS key is AKIAABCDEFGHIJKLMNOP")
    _, blob, manifest = build_bundle(poisoned)
    everything = "\n".join(_unzip(blob).values())
    for key in FAKE_KEYS[:5]:
        assert key not in everything
    assert manifest["secretsRedacted"] >= 4


def test_invalid_format_blocks_the_bundle():
    assert not all(c["passed"] for c in validate_file("x.json", "{not json"))
    assert not all(c["passed"] for c in validate_file("x.mdc", "no front matter"))
    with pytest.raises(BundleValidationError):
        from aifit import bundle

        original = bundle.bundle_files
        bundle.bundle_files = lambda r: [("broken.json", "{")]
        try:
            build_bundle({})
        finally:
            bundle.bundle_files = original


def test_export_endpoint_returns_the_validated_bundle(result):
    client = TestClient(app)
    res = client.post("/v1/export/pack", json={"persona": result["persona"], "result": result})
    assert res.status_code == 200
    body = res.json()
    files = _unzip(base64.b64decode(body["content"]))
    assert "ai-profile/manifest.json" in files
    assert body["manifest"]["validation"]["status"] == "format_checks_passed"


def test_single_file_export_is_redacted(result):
    poisoned = json.loads(json.dumps(result))
    poisoned["persona"]["interaction_rules"] = ["key sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345"]
    res = TestClient(app).post("/v1/export/claude", json={"persona": poisoned["persona"], "result": poisoned})
    assert res.status_code == 200
    assert "sk-ant-" not in res.json()["content"]
    assert res.json()["secretsRedacted"] == 1


def test_activation_counts_only_known_events():
    client = TestClient(app)
    before = client.get("/v1/analytics/summary").json()["activation"]["check_completed"]
    assert client.post("/v1/activation", json={"event": "check_completed"}).status_code == 200
    assert client.post("/v1/activation", json={"event": "drop table users"}).status_code == 400
    after = client.get("/v1/analytics/summary").json()["activation"]
    assert after["check_completed"] == before + 1
    assert "drop table users" not in after
