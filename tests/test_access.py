from fastapi.testclient import TestClient

from services.api.access import access_mode, code_is_valid, redact_email


def test_redact_email_hides_local_and_host() -> None:
    assert redact_email("founder@example.com") == "f***@e***.com"
    assert "@example.com" not in redact_email("founder@example.com")


def test_access_mode_defaults_off(monkeypatch) -> None:
    monkeypatch.delenv("FIT_ACCESS_GATE", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_FIT_ACCESS_GATE", raising=False)
    assert access_mode() == "off"


def test_code_is_valid_is_case_insensitive(monkeypatch) -> None:
    monkeypatch.setenv("FIT_ACCESS_CODES", "Let-Me-In, beta")
    assert code_is_valid("let-me-in")
    assert code_is_valid("BETA")
    assert not code_is_valid("nope")


def test_waitlist_and_code_endpoints(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FIT_WAITLIST_PATH", str(tmp_path / "waitlist.jsonl"))
    monkeypatch.setenv("FIT_ACCESS_GATE", "off")
    from services.api.main import app

    client = TestClient(app)
    assert client.get("/v1/access").json() == {"mode": "off", "note": ""}
    assert client.post("/v1/waitlist", json={"email": "founder@example.com"}).status_code == 404
    assert client.post("/v1/access/unlock", json={"code": "let-me-in"}).status_code == 404

    monkeypatch.setenv("FIT_ACCESS_GATE", "waitlist")
    monkeypatch.setenv("FIT_WAITLIST_NOTE", "Friends first")
    created = client.post("/v1/waitlist", json={"email": "founder@example.com", "source": "test"})
    assert created.status_code == 200
    assert created.json()["ok"] is True
    listed = client.get("/v1/waitlist")
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["count"] == 1
    assert "recent" not in payload
    assert "founder@example.com" not in listed.text
    status = client.get("/v1/access").json()
    assert status["mode"] == "waitlist"
    assert status["note"] == "Friends first"

    monkeypatch.setenv("FIT_ACCESS_GATE", "code")
    monkeypatch.setenv("FIT_ACCESS_CODES", "let-me-in")
    assert client.get("/v1/access").json()["mode"] == "code"
    denied = client.post("/v1/access/unlock", json={"code": "wrong"})
    assert denied.status_code == 403
    allowed = client.post("/v1/access/unlock", json={"code": "LET-ME-IN"})
    assert allowed.status_code == 200
    assert allowed.json()["ok"] is True


def test_waitlist_rejects_bad_email(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FIT_WAITLIST_PATH", str(tmp_path / "waitlist.jsonl"))
    monkeypatch.setenv("FIT_ACCESS_GATE", "waitlist")
    from services.api.main import app

    client = TestClient(app)
    rejected = client.post("/v1/waitlist", json={"email": "not-an-email"})
    assert rejected.status_code == 422