"""Consumer lead capture, password reset and receipts."""

from __future__ import annotations

import json
import time

import pytest
from fastapi.testclient import TestClient

from aifit import accounts as acct
from aifit import billing as bill
from aifit import leads as lead_mod
from aifit import mailer
from services.api import main

H = {"X-AIFit-Request": "1"}
LEAD = {
    "email": " Pat@Example.com ",
    "interest": "assessment",
    "consent": True,
    "source": {
        "app": "ai-fit",
        "page": "for/developers",
        "attribution": {
            "utm": {"utm_source": "google", "utm_campaign": "q4"},
            "clickIds": {},
            "landingPath": "/",
            "firstSeenAt": "2026-10-29T00:00:00Z",
        },
    },
}


@pytest.fixture
def mail(monkeypatch):
    sent: list[dict] = []
    monkeypatch.setattr(
        main,
        "MAIL",
        mailer.mail_config({"RESEND_API_KEY": "re_test", "EMAIL_FROM": "hello@example.com", "APP_URL": "http://testserver"}),
    )

    def fake_send(cfg, to, subject, text, idempotency_key=None, transport=None):
        sent.append({"to": to, "subject": subject, "text": text, "key": idempotency_key})
        return True

    monkeypatch.setattr(mailer, "send", fake_send)
    return sent


def test_lead_is_validated_stored_and_exported(monkeypatch):
    c = TestClient(main.app)
    monkeypatch.setenv("LEADS_EXPORT_TOKEN", "x" * 32)
    r = c.post("/v1/leads", json=LEAD, headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["stored"] is True
    assert c.post("/v1/leads", json={**LEAD, "consent": False}, headers=H).status_code == 422
    assert c.post("/v1/leads", json={**LEAD, "email": "nope"}, headers=H).status_code == 422
    assert c.post("/v1/leads", json={**LEAD, "admin": True}, headers=H).status_code == 422
    assert c.post("/v1/leads", json=LEAD).status_code == 403
    assert c.get("/v1/leads").status_code == 401
    rows = c.get("/v1/leads", headers={"Authorization": "Bearer " + "x" * 32}).json()["leads"]
    assert rows[0]["email"] == "pat@example.com"
    assert "consent" not in rows[0] and "website" not in rows[0]
    csv = c.get("/v1/leads?format=csv", headers={"Authorization": "Bearer " + "x" * 32}).text
    assert "google" in csv.splitlines()[1]


def test_lead_export_off_without_token(monkeypatch):
    monkeypatch.delenv("LEADS_EXPORT_TOKEN", raising=False)
    assert TestClient(main.app).get("/v1/leads").status_code == 503


def test_honeypot_keeps_nothing():
    before = len(lead_mod.recent(main.RESULT_STORE))
    r = TestClient(main.app).post("/v1/leads", json={**LEAD, "email": "bot@example.com", "website": "x"}, headers=H)
    assert r.status_code == 200 and r.json()["stored"] is False
    assert len(lead_mod.recent(main.RESULT_STORE)) == before


def test_csv_neutralises_formulas_and_forward_signs():
    rows = [
        {"receivedAt": "t", "email": "a@b.co", "name": "=cmd()", "interest": "other", "source": {"app": "ai-fit", "page": "x"}}
    ]
    assert "'=cmd()" in lead_mod.to_csv(rows)
    seen = {}

    def transport(url, headers, body):
        seen.update(headers=headers, body=body)
        return 200

    assert lead_mod.forward("https://hooks.example/x", "s3cret", {"id": "lead_1"}, transport) is True
    t = int(seen["headers"]["X-AIFit-Signature"].split(",")[0][2:])
    assert seen["headers"]["X-AIFit-Signature"] == lead_mod.sign(seen["body"], "s3cret", t)
    assert lead_mod.forward("http://insecure.example", None, {"id": "x"}) is False
    assert lead_mod.forward("https://down.example", None, {"id": "x"}, lambda *a: (_ for _ in ()).throw(OSError())) is False


def test_password_reset_signs_out_everyone_and_is_single_use(mail):
    a, b = TestClient(main.app), TestClient(main.app)
    a.post("/v1/account/signup", json={"email": "reset@example.com", "password": "correct horse battery"}, headers=H)
    b.post("/v1/account/login", json={"email": "reset@example.com", "password": "correct horse battery"}, headers=H)
    unknown = TestClient(main.app).post("/v1/account/password/reset", json={"email": "nobody@example.com"}, headers=H).json()
    known = TestClient(main.app).post("/v1/account/password/reset", json={"email": "reset@example.com"}, headers=H).json()
    assert unknown == known  # does not reveal who has an account
    assert len(mail) == 1 and mail[0]["to"] == "reset@example.com"
    token = mail[0]["text"].split("token=")[1].split()[0]
    c = TestClient(main.app)
    assert c.post("/v1/account/password/reset/complete", json={"token": token, "password": "short"}, headers=H).status_code == 400
    # A rejected password does not burn the token: the same link still works.
    assert (
        c.post(
            "/v1/account/password/reset/complete", json={"token": token, "password": "a brand new long password"}, headers=H
        ).status_code
        == 200
    )
    assert a.get("/v1/account/me").status_code == 401
    assert b.get("/v1/account/me").status_code == 401
    assert (
        c.post(
            "/v1/account/password/reset/complete", json={"token": token, "password": "another long password!"}, headers=H
        ).status_code
        == 400
    )
    assert (
        TestClient(main.app)
        .post("/v1/account/login", json={"email": "reset@example.com", "password": "a brand new long password"}, headers=H)
        .status_code
        == 200
    )
    assert mail[-1]["subject"].startswith("Your AI Fit password was changed")


def test_reset_off_without_email(monkeypatch):
    monkeypatch.setattr(main, "MAIL", mailer.mail_config({}))
    assert TestClient(main.app).post("/v1/account/password/reset", json={"email": "a@example.com"}, headers=H).status_code == 503


def test_reset_token_expires():
    store = main.RESULT_STORE
    user, _ = acct.sign_up(store, acct.SignUp(email="exp@example.com", password="correct horse battery"))
    _, token = acct.start_password_reset(store, "exp@example.com")
    from datetime import datetime, timedelta, timezone

    with pytest.raises(acct.AccountError):
        acct.complete_password_reset(
            store, token, "a brand new long password", at=datetime.now(timezone.utc) + timedelta(minutes=31)
        )


def test_paid_webhook_sends_one_receipt(monkeypatch, mail):
    secret = "whsec_receipts"
    monkeypatch.setattr(
        main,
        "BILLING",
        bill.billing_config(
            {
                "BILLING_MODE": "test",
                "STRIPE_SECRET_KEY": "sk_test_x",
                "STRIPE_WEBHOOK_SECRET": secret,
                "STRIPE_PRICE_PRO": "price_pro",
            }
        ),
    )
    c = TestClient(main.app)
    uid = c.post("/v1/account/signup", json={"email": "paid@example.com", "password": "correct horse battery"}, headers=H).json()[
        "user"
    ]["id"]
    event = {
        "id": "evt_receipt_1",
        "type": "checkout.session.completed",
        "created": int(time.time()),
        "livemode": False,
        "data": {
            "object": {
                "id": "cs_r1",
                "payment_status": "paid",
                "amount_total": 1200,
                "currency": "usd",
                "customer_details": {"email": "paid@example.com"},
                "metadata": {"userId": uid, "product": "consumer-pro"},
            }
        },
    }
    raw = json.dumps(event).encode()
    for _ in range(2):
        c.post("/v1/billing/webhook", content=raw, headers={"stripe-signature": bill.sign_payload(raw, secret)})
    receipts = [m for m in mail if m["subject"].startswith("Receipt")]
    assert len(receipts) == 1 and "12.00 USD" in receipts[0]["text"] and receipts[0]["key"] == "receipt-evt_receipt_1"
