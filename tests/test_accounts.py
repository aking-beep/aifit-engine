"""Consumer accounts, isolation between accounts, plan limits and Pro billing lifecycle."""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from aifit import billing as bill
from services.api import main

H = {"X-AIFit-Request": "1"}
SECRET = "whsec_test_secret"
TEST_ENV = {
    "BILLING_MODE": "test",
    "STRIPE_SECRET_KEY": "sk_test_x",
    "STRIPE_WEBHOOK_SECRET": SECRET,
    "STRIPE_PRICE_PRO": "price_pro",
    "APP_URL": "http://testserver",
}


def client() -> TestClient:
    return TestClient(main.app)


def signup(c: TestClient, email: str, password: str = "correct horse battery") -> dict:
    r = c.post("/v1/account/signup", json={"email": email, "password": password, "name": "Sam"}, headers=H)
    assert r.status_code == 200, r.text
    return r.json()


def quiz_session(c: TestClient) -> tuple[str, str]:
    demo = c.post("/v1/sessions/demo").json()
    return demo["session_id"], demo["token"]


@pytest.fixture
def billing_on(monkeypatch):
    monkeypatch.setattr(main, "BILLING", bill.billing_config(TEST_ENV))
    yield main.BILLING


def webhook(c: TestClient, event: dict) -> dict:
    raw = json.dumps(event).encode()
    r = c.post("/v1/billing/webhook", content=raw, headers={"stripe-signature": bill.sign_payload(raw, SECRET)})
    assert r.status_code == 200, r.text
    return r.json()


def event(kind: str, obj: dict, created: int | None = None, eid: str | None = None) -> dict:
    return {
        "id": eid or f"evt_{kind.replace('.', '_')}_{time.time_ns()}",
        "type": kind,
        "created": created or int(time.time()),
        "livemode": False,
        "data": {"object": obj},
    }


# Accounts ------------------------------------------------------------------


def test_signup_login_logout_and_cookie_flags():
    c = client()
    me = signup(c, "a1@example.com")
    assert me["user"]["email"] == "a1@example.com"
    assert "password" not in json.dumps(me)
    assert c.get("/v1/account/me").status_code == 200
    assert c.post("/v1/account/logout", headers=H).status_code == 200
    assert c.get("/v1/account/me").status_code == 401
    r = c.post("/v1/account/login", json={"email": "A1@example.com", "password": "correct horse battery"}, headers=H)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_duplicate_email_and_wrong_password_do_not_leak():
    c = client()
    signup(c, "dup@example.com")
    assert (
        client()
        .post("/v1/account/signup", json={"email": "dup@example.com", "password": "another long password"}, headers=H)
        .status_code
        == 409
    )
    wrong = client().post("/v1/account/login", json={"email": "dup@example.com", "password": "nope nope nope"}, headers=H)
    unknown = client().post("/v1/account/login", json={"email": "nobody@example.com", "password": "nope nope nope"}, headers=H)
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_short_password_rejected_and_lockout():
    c = client()
    assert c.post("/v1/account/signup", json={"email": "s@example.com", "password": "short"}, headers=H).status_code == 422
    signup(c, "lock@example.com")
    for _ in range(10):
        client().post("/v1/account/login", json={"email": "lock@example.com", "password": "wrong password!"}, headers=H)
    r = client().post("/v1/account/login", json={"email": "lock@example.com", "password": "correct horse battery"}, headers=H)
    assert r.status_code == 429


def test_mutations_need_header_and_same_origin():
    c = client()
    r = c.post("/v1/account/signup", json={"email": "csrf@example.com", "password": "correct horse battery"})
    assert r.status_code == 403
    r = c.post(
        "/v1/account/signup",
        json={"email": "csrf@example.com", "password": "correct horse battery"},
        headers={**H, "Origin": "https://evil.example"},
    )
    assert r.status_code == 403
    r = c.post(
        "/v1/account/signup",
        json={"email": "csrf@example.com", "password": "correct horse battery"},
        headers={**H, "Origin": "http://testserver"},
    )
    assert r.status_code == 200


def test_saved_assessment_is_scored_server_side_and_isolated():
    alice, bob = client(), client()
    signup(alice, "alice@example.com")
    signup(bob, "bob@example.com")
    sid, tok = quiz_session(alice)
    # Bob cannot save Alice's quiz session without its token.
    assert bob.post("/v1/account/assessments", json={"kind": "quiz", "session_id": sid}, headers=H).status_code == 403
    r = alice.post("/v1/account/assessments", json={"kind": "quiz", "session_id": sid, "session_token": tok}, headers=H)
    assert r.status_code == 200
    entry = r.json()
    assert entry["result"]["persona"]
    assert alice.get("/v1/account/profile").json()["entry"]["id"] == entry["id"]
    assert bob.get("/v1/account/profile").json()["entry"] is None
    assert bob.get("/v1/account/history").json()["items"] == []
    assert bob.delete(f"/v1/account/history/{entry['id']}", headers=H).status_code == 404
    assert len(alice.get("/v1/account/history").json()["items"]) == 1


def test_check_is_decided_server_side():
    c = client()
    signup(c, "check@example.com")
    intake = {
        "goal": "Copy invoice totals into a spreadsheet",
        "workTypes": ["transfer", "calculate"],
        "frequencyPerMonth": 40,
        "minutesPerOccurrence": 10,
        "correctness": "exact",
        "errorImpact": "medium",
        "technicalAbility": "basic",
    }
    r = c.post("/v1/account/assessments", json={"kind": "check", "intake": intake}, headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["result"]["decision"]["outcome"]
    # The client cannot hand in its own decision: anything but the intake is ignored.
    forged = c.post(
        "/v1/account/assessments", json={"kind": "check", "intake": {**intake, "surface": "teams"}, "result": {"x": 1}}, headers=H
    )
    assert forged.status_code in (200, 422)


def test_saved_items_export_and_delete():
    c = client()
    signup(c, "saved@example.com")
    item = c.post("/v1/account/saved", json={"kind": "tool", "ref": "claude", "label": "Claude"}, headers=H).json()
    again = c.post("/v1/account/saved", json={"kind": "tool", "ref": "claude", "label": "Claude"}, headers=H).json()
    assert item["id"] == again["id"]
    assert c.post("/v1/account/saved", json={"kind": "tool", "ref": "<script>", "label": "x"}, headers=H).status_code == 422
    exported = c.get("/v1/account/export").json()
    assert exported["saved"][0]["ref"] == "claude"
    assert "scrypt$" not in json.dumps(exported) and "password" not in exported["account"]
    assert c.delete("/v1/account", headers=H).status_code == 200
    assert c.get("/v1/account/me").status_code == 401
    assert (
        client()
        .post("/v1/account/login", json={"email": "saved@example.com", "password": "correct horse battery"}, headers=H)
        .status_code
        == 401
    )


def test_billing_off_means_no_limits():
    c = client()
    signup(c, "free@example.com")
    sid, tok = quiz_session(c)
    c.post("/v1/account/assessments", json={"kind": "quiz", "session_id": sid, "session_token": tok}, headers=H)
    me = c.get("/v1/account/me").json()
    assert me["account"]["plan"] == "all-features"
    assert all(v is None for v in me["account"]["limits"].values())
    assert c.post("/v1/account/package", headers=H).status_code == 200
    assert c.post("/v1/account/package", headers=H).status_code == 200
    assert c.post("/v1/account/billing/checkout", headers=H).status_code == 503


# Billing -------------------------------------------------------------------


def test_config_refuses_live_key_in_test_and_live_without_switch():
    assert not bill.billing_config({**TEST_ENV, "STRIPE_SECRET_KEY": "sk_live_x"}).enabled
    assert not bill.billing_config({**TEST_ENV, "BILLING_MODE": "live", "STRIPE_SECRET_KEY": "sk_live_x"}).enabled
    assert not bill.billing_config({**TEST_ENV, "STRIPE_WEBHOOK_SECRET": ""}).enabled
    assert bill.billing_config(TEST_ENV).mode == "test"


def test_free_limits_enforced_server_side(billing_on):
    c = client()
    signup(c, "limits@example.com")
    sid, tok = quiz_session(c)
    entry = c.post("/v1/account/assessments", json={"kind": "quiz", "session_id": sid, "session_token": tok}, headers=H).json()
    assert len(entry["result"]["products"]) <= bill.FREE_LIMITS["recommendations"]
    assert c.post("/v1/account/package", headers=H).status_code == 200
    assert c.post("/v1/account/package", headers=H).status_code == 402
    ids = ",".join(p["id"] for p in main.PRODUCT_RECORDS[:3])
    assert c.get(f"/v1/account/compare?ids={ids}").status_code == 402
    two = ",".join(p["id"] for p in main.PRODUCT_RECORDS[:2])
    assert len(c.get(f"/v1/account/compare?ids={two}").json()["items"]) == 2


def test_checkout_calls_stripe_with_metadata(billing_on, monkeypatch):
    seen = {}

    def fake(url, headers, body):
        seen.update(url=url, headers=headers, body=body.decode())
        return 200, {"id": "cs_test_1", "url": "https://checkout.stripe.com/c/cs_test_1"}

    monkeypatch.setattr(bill, "_urllib_transport", fake)
    c = client()
    me = signup(c, "checkout@example.com")
    r = c.post("/v1/account/billing/checkout", headers=H)
    assert r.status_code == 200
    assert r.json()["url"].startswith("https://checkout.stripe.com/")
    assert "price_pro" in seen["body"] and me["user"]["id"] in seen["body"]
    assert seen["headers"]["Idempotency-Key"]
    # The redirect alone grants nothing.
    assert c.get("/v1/account/me").json()["account"]["plan"] == "free"


def _paid(c: TestClient, user_id: str, session: str = "cs_test_paid") -> None:
    webhook(
        c,
        event(
            "checkout.session.completed",
            {
                "id": session,
                "payment_status": "paid",
                "subscription": "sub_1",
                "customer": "cus_1",
                "amount_total": 1200,
                "currency": "usd",
                "client_reference_id": user_id,
                "metadata": {"userId": user_id, "product": "consumer-pro"},
            },
        ),
    )


def test_paid_webhook_grants_pro_and_duplicates_are_ignored(billing_on):
    c = client()
    uid = signup(c, "pro@example.com")["user"]["id"]
    evt = event(
        "checkout.session.completed",
        {
            "id": "cs_dup",
            "payment_status": "paid",
            "subscription": "sub_d",
            "customer": "cus_d",
            "amount_total": 1200,
            "currency": "usd",
            "metadata": {"userId": uid, "product": "consumer-pro"},
        },
        eid="evt_duplicate_1",
    )
    assert webhook(c, evt)["status"] == "processed"
    assert webhook(c, evt)["status"] == "duplicate"
    billing = c.get("/v1/account/billing").json()
    assert billing["plan"] == "pro"
    assert len([p for p in billing["payments"] if p["kind"] == "checkout"]) == 1
    assert c.get("/v1/account/billing/checkout/cs_dup").json()["status"] == "paid"
    assert client().get("/v1/account/billing/checkout/cs_dup").status_code == 401


def test_bad_signature_and_wrong_mode_rejected(billing_on):
    c = client()
    raw = json.dumps(event("invoice.paid", {"id": "in_1"})).encode()
    assert (
        c.post(
            "/v1/billing/webhook", content=raw, headers={"stripe-signature": bill.sign_payload(raw, "whsec_other")}
        ).status_code
        == 400
    )
    assert c.post("/v1/billing/webhook", content=raw).status_code == 400
    stale = bill.sign_payload(raw, SECRET, int(time.time()) - 3600)
    assert c.post("/v1/billing/webhook", content=raw, headers={"stripe-signature": stale}).status_code == 400
    live = {**event("invoice.paid", {"id": "in_2"}), "livemode": True}
    assert webhook(c, live)["status"] == "ignored"


def test_failed_and_canceled_checkouts_grant_nothing(billing_on):
    c = client()
    uid = signup(c, "fail@example.com")["user"]["id"]
    for kind in ("checkout.session.async_payment_failed", "checkout.session.expired"):
        webhook(c, event(kind, {"id": f"cs_{kind[-6:]}", "metadata": {"userId": uid, "product": "consumer-pro"}}))
    billing = c.get("/v1/account/billing").json()
    assert billing["plan"] == "free"
    assert {p["status"] for p in billing["payments"]} == {"failed", "expired"}
    unpaid = event(
        "checkout.session.completed",
        {"id": "cs_unpaid", "payment_status": "unpaid", "metadata": {"userId": uid, "product": "consumer-pro"}},
    )
    webhook(c, unpaid)
    assert c.get("/v1/account/me").json()["account"]["plan"] == "free"


def test_cancel_at_period_end_then_deleted(billing_on):
    c = client()
    uid = signup(c, "cancel@example.com")["user"]["id"]
    _paid(c, uid, "cs_cancel")
    end = int((datetime.now(timezone.utc) + timedelta(days=20)).timestamp())
    webhook(
        c,
        event(
            "customer.subscription.updated",
            {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "active",
                "cancel_at_period_end": True,
                "current_period_end": end,
                "metadata": {"userId": uid},
            },
        ),
    )
    me = c.get("/v1/account/me").json()["account"]
    assert me["state"] == "canceling" and me["plan"] == "pro"
    webhook(
        c,
        event(
            "customer.subscription.deleted",
            {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "canceled",
                "ended_at": int(time.time()) - 5,
                "metadata": {"userId": uid},
            },
        ),
    )
    me = c.get("/v1/account/me").json()["account"]
    assert me["state"] == "canceled" and me["plan"] == "free"


def test_payment_failed_then_recovered_and_expiry(billing_on):
    c = client()
    uid = signup(c, "pastdue@example.com")["user"]["id"]
    _paid(c, uid, "cs_pastdue")
    webhook(
        c,
        event(
            "invoice.payment_failed",
            {"id": "in_f", "customer": "cus_1", "amount_due": 1200, "subscription_details": {"metadata": {"userId": uid}}},
        ),
    )
    assert c.get("/v1/account/me").json()["account"]["state"] == "past_due"
    period_end = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
    webhook(
        c,
        event(
            "invoice.paid",
            {
                "id": "in_ok",
                "customer": "cus_1",
                "amount_paid": 1200,
                "period_end": period_end,
                "subscription_details": {"metadata": {"userId": uid}},
            },
        ),
    )
    assert c.get("/v1/account/me").json()["account"]["state"] == "active"
    ent = bill.read_entitlements(main.RESULT_STORE, uid)
    later = datetime.now(timezone.utc) + timedelta(days=34)
    assert bill.subscription_state(ent, later) == "expired"
    assert not bill.is_pro(main.BILLING, ent, later)


def test_full_refund_ends_pro_partial_does_not(billing_on):
    c = client()
    uid = signup(c, "refund@example.com")["user"]["id"]
    _paid(c, uid, "cs_refund")
    webhook(c, event("charge.refunded", {"id": "ch_p", "customer": "cus_1", "refunded": False, "amount_refunded": 300}))
    assert c.get("/v1/account/me").json()["account"]["plan"] == "pro"
    webhook(
        c,
        event(
            "charge.refunded",
            {"id": "ch_f", "customer": "cus_1", "refunded": True, "amount_refunded": 1200},
            created=int(time.time()) + 1,
        ),
    )
    me = c.get("/v1/account/me").json()["account"]
    assert me["state"] == "refunded" and me["plan"] == "free"


def test_unknown_account_events_are_ignored(billing_on):
    c = client()
    assert (
        webhook(c, event("customer.subscription.updated", {"id": "sub_x", "metadata": {"userId": "usr_missing"}}))["status"]
        == "ignored"
    )
    assert webhook(c, event("payment_intent.created", {"id": "pi_1"}))["status"] == "ignored"
