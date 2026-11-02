"""Operator alerts: off by default, throttled, scrubbed, and wired to billing failures."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from aifit import alerts
from services.api import main


class _Store:
    def __init__(self) -> None:
        self.keys: set[str] = set()

    def put_new(self, kind, key, payload, ttl=None):
        if (kind, key) in self.keys:
            return False
        self.keys.add((kind, key))
        return True


def _capture():
    calls: list[dict] = []

    def transport(url, headers, body):
        calls.append({"url": url, "body": json.loads(body)})
        return 200

    return calls, transport


def test_off_unless_configured():
    assert not alerts.alert_config({}).enabled
    assert not alerts.alert_config({"ALERT_WEBHOOK_URL": "http://hooks.example/x"}).enabled
    assert not alerts.alert_config({"ALERT_EMAIL": "nope"}).enabled
    calls, transport = _capture()
    assert alerts.raise_alert(alerts.alert_config({}), _Store(), "server_error", "x", transport=transport) is False
    assert calls == []


def test_posts_once_per_kind_per_window():
    cfg = alerts.alert_config({"ALERT_WEBHOOK_URL": "https://hooks.example/x", "VERCEL_ENV": "production"})
    store = _Store()
    calls, transport = _capture()
    assert alerts.raise_alert(cfg, store, "webhook_failed", "503 billing off", transport=transport)
    assert not alerts.raise_alert(cfg, store, "webhook_failed", "again", transport=transport)
    assert alerts.raise_alert(cfg, store, "checkout_failed", "other kind", transport=transport)
    assert len(calls) == 2
    assert calls[0]["body"]["text"].startswith("[ai-fit production] webhook failed")
    assert calls[0]["body"]["text"] == calls[0]["body"]["content"]


def test_scrubs_customer_data_and_never_raises():
    assert alerts.scrub("pat@example.com sk_live_abc whsec_x Bearer a.b") == "[email] [key] [key] Bearer [key]"

    def broken(url, headers, body):
        raise OSError("network down")

    cfg = alerts.alert_config({"ALERT_WEBHOOK_URL": "https://hooks.example/x"})
    assert alerts.raise_alert(cfg, _Store(), "server_error", "x", transport=broken) is False


def test_webhook_on_a_billing_off_deployment_alerts_the_operator(monkeypatch):
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(main, "_alert", lambda kind, detail: sent.append((kind, detail)) or True)
    res = TestClient(main.app).post("/v1/billing/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=x"})
    assert res.status_code == 503
    assert sent and sent[0][0] == "webhook_failed"
