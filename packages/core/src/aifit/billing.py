"""Consumer Pro billing: configuration, entitlements, plan limits and Stripe.

Same rules as the Teams platform package:

* Billing is decided from the environment. ``off`` (the default) means every
  feature is free and no checkout is offered. ``test`` needs an ``sk_test_``
  key. ``live`` needs an ``sk_live_`` key AND ``BILLING_ALLOW_LIVE=1``.
* Checkout happens on Stripe's hosted page. Pro is granted only by a
  verified webhook, never by the success redirect.
* Each webhook event is applied once; replays answer ``duplicate``.

Plan limits live in ``FREE_LIMITS``, in one place. They apply only while
billing is on; with billing off every account has every feature.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from .accounts import K_ENTITLEMENTS, K_USERS, AccountError, Store, _iso, _parse, now_utc

Mode = Literal["off", "test", "live"]
State = Literal["none", "active", "canceling", "past_due", "canceled", "expired", "refunded"]

RENEWAL_GRACE = timedelta(days=3)
MAX_PAYMENTS = 200
K_EVENTS = "acct_stripe_events"
K_LOCKS = "stripe_event_locks"
K_CHECKOUTS = "acct_checkouts"
K_CUSTOMERS = "acct_customers"

# What the Free plan allows while billing is on. Pro has no limits.
FREE_LIMITS: dict[str, int] = {
    "recommendations": 3,  # tools shown in the account's recommendations
    "config_packages_per_month": 1,  # full setup packages (ZIP) built from the account
    "compare_tools": 2,  # tools side by side
    "history_days": 30,  # how far back assessment history is shown
    "saved_items": 10,
}


@dataclass(frozen=True)
class BillingConfig:
    mode: Mode
    enabled: bool
    reason: str
    app_url: str
    secret_key: str | None = None
    webhook_secret: str | None = None
    price_pro: str | None = None
    extra: dict[str, str] = field(default_factory=dict)

    def public(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "enabled": self.enabled,
            "reason": self.reason,
            "pro_available": bool(self.enabled and self.price_pro),
        }


def billing_config(env: dict[str, str | None]) -> BillingConfig:
    requested = (env.get("BILLING_MODE") or "off").strip().lower()
    vercel = env.get("VERCEL_URL")
    app_url = (env.get("APP_URL") or (f"https://{vercel}" if vercel else "http://localhost:3000")).rstrip("/")
    price = (env.get("STRIPE_PRICE_PRO") or "").strip() or None

    def off(reason: str) -> BillingConfig:
        return BillingConfig("off", False, reason, app_url, price_pro=price)

    if requested in ("", "off"):
        return off("Billing is off (BILLING_MODE is not set). Every feature is available without payment.")
    if requested not in ("test", "live"):
        return off(f'Unknown BILLING_MODE "{requested}"; billing stays off.')
    key = (env.get("STRIPE_SECRET_KEY") or "").strip()
    secret = (env.get("STRIPE_WEBHOOK_SECRET") or "").strip()
    if not key:
        return off("BILLING_MODE is set but STRIPE_SECRET_KEY is missing; billing stays off.")
    if not secret.startswith("whsec_"):
        return off(
            "STRIPE_WEBHOOK_SECRET is missing or malformed; without it payments cannot be fulfilled, so billing stays off."
        )
    if not price:
        return off("STRIPE_PRICE_PRO is not set; billing stays off.")
    if requested == "test":
        if not key.startswith(("sk_test_", "rk_test_")):
            return off("BILLING_MODE=test requires a Stripe test key (sk_test_…). A live key was refused.")
        return BillingConfig("test", True, "Stripe test mode. No real money moves.", app_url, key, secret, price)
    if not key.startswith(("sk_live_", "rk_live_")):
        return off("BILLING_MODE=live requires a live key; billing stays off.")
    if env.get("BILLING_ALLOW_LIVE") != "1":
        return off("Live billing needs BILLING_ALLOW_LIVE=1 as a second, explicit switch; billing stays off.")
    return BillingConfig("live", True, "Live billing is enabled.", app_url, key, secret, price)


# Entitlements ----------------------------------------------------------------


def read_entitlements(store: Store, user_id: str) -> dict[str, Any]:
    ent = store.get(K_ENTITLEMENTS, user_id) or {}
    ent.setdefault("plan", "free")
    ent.setdefault("subscription", None)
    ent.setdefault("payments", [])
    ent.setdefault("usage", {})
    return ent


def write_entitlements(store: Store, user_id: str, ent: dict[str, Any]) -> None:
    ent["payments"] = ent.get("payments", [])[-MAX_PAYMENTS:]
    store.put(K_ENTITLEMENTS, user_id, ent)


def subscription_state(ent: dict[str, Any], at: datetime | None = None) -> State:
    at = at or now_utc()
    sub = ent.get("subscription")
    if not sub:
        return "none"
    refunded, paid = _parse(sub.get("refunded_at")), _parse(sub.get("last_paid_at"))
    if refunded and (not paid or refunded >= paid):
        return "refunded"
    end = _parse(sub.get("current_period_end"))
    status = sub.get("status")
    if status in ("active", "trialing"):
        if end and at > end + RENEWAL_GRACE:
            return "expired"
        return "canceling" if sub.get("cancel_at_period_end") else "active"
    if status == "past_due":
        return "past_due"
    if status == "canceled" and end and at < end:
        return "canceling"
    return "canceled" if status == "canceled" else "expired"


def is_pro(cfg: BillingConfig, ent: dict[str, Any], at: datetime | None = None) -> bool:
    if not cfg.enabled:
        return True
    return subscription_state(ent, at) in ("active", "canceling")


def limits_for(cfg: BillingConfig, ent: dict[str, Any], at: datetime | None = None) -> dict[str, int | None]:
    """None means unlimited."""
    if is_pro(cfg, ent, at):
        return {k: None for k in FREE_LIMITS}
    return dict(FREE_LIMITS)


def _month(at: datetime) -> str:
    return at.strftime("%Y-%m")


def packages_used(ent: dict[str, Any], at: datetime | None = None) -> int:
    return int(ent.get("usage", {}).get(_month(at or now_utc()), {}).get("packages", 0))


def consume_package(store: Store, cfg: BillingConfig, user_id: str, at: datetime | None = None) -> None:
    """Counts one setup package against this month's allowance, or refuses."""
    at = at or now_utc()
    ent = read_entitlements(store, user_id)
    cap = limits_for(cfg, ent, at)["config_packages_per_month"]
    used = packages_used(ent, at)
    if cap is not None and used >= cap:
        raise AccountError("limit", f"The Free plan includes {cap} setup package a month. Upgrade to Pro for unlimited packages.")
    month = ent["usage"].setdefault(_month(at), {})
    month["packages"] = used + 1
    # Keep a year of usage counters.
    ent["usage"] = dict(sorted(ent["usage"].items())[-12:])
    write_entitlements(store, user_id, ent)


def account_summary(cfg: BillingConfig, ent: dict[str, Any], at: datetime | None = None) -> dict[str, Any]:
    at = at or now_utc()
    state = subscription_state(ent, at)
    sub = ent.get("subscription") or {}
    return {
        "billing": cfg.public(),
        "plan": "pro" if is_pro(cfg, ent, at) and cfg.enabled else ("all-features" if not cfg.enabled else "free"),
        "state": state,
        "current_period_end": sub.get("current_period_end"),
        "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
        "limits": limits_for(cfg, ent, at),
        "usage": {"config_packages_this_month": packages_used(ent, at)},
    }


def record_payment(ent: dict[str, Any], row: dict[str, Any]) -> None:
    rows = ent.setdefault("payments", [])
    # The same Stripe object id updates its row instead of adding a second one.
    for i, existing in enumerate(rows):
        if existing.get("id") == row["id"] and existing.get("kind") == row["kind"]:
            rows[i] = {**existing, **row}
            return
    rows.append(row)


# Stripe ----------------------------------------------------------------------

Transport = Callable[[str, dict[str, str], bytes], tuple[int, dict[str, Any]]]


def _urllib_transport(url: str, headers: dict[str, str], body: bytes) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, json.loads(res.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode("utf-8") or "{}")
        except (ValueError, OSError):
            return exc.code, {}
    except (urllib.error.URLError, TimeoutError, ValueError):
        return 0, {}


def create_checkout(
    cfg: BillingConfig, user: dict[str, Any], idempotency_key: str, transport: Transport | None = None
) -> dict[str, str]:
    """A Stripe-hosted Checkout Session for Pro. Card details never touch this app."""
    if not cfg.enabled or not cfg.secret_key or not cfg.price_pro:
        raise AccountError("unavailable", cfg.reason)
    params = {
        "mode": "subscription",
        "line_items[0][price]": cfg.price_pro,
        "line_items[0][quantity]": "1",
        "success_url": f"{cfg.app_url}/app/subscription?status=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{cfg.app_url}/app/subscription?status=cancelled",
        "client_reference_id": user["id"],
        "customer_email": user["email"],
        "metadata[userId]": user["id"],
        "metadata[product]": "consumer-pro",
        "subscription_data[metadata][userId]": user["id"],
        "subscription_data[metadata][product]": "consumer-pro",
    }
    status, body = (transport or _urllib_transport)(
        "https://api.stripe.com/v1/checkout/sessions",
        {
            "Authorization": f"Bearer {cfg.secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": idempotency_key,
        },
        urllib.parse.urlencode(params).encode("ascii"),
    )
    if status != 200 or not body.get("id") or not body.get("url"):
        message = (body.get("error") or {}).get("message") if isinstance(body.get("error"), dict) else None
        raise AccountError("unavailable", f"Stripe did not create a checkout session{': ' + message if message else ''}.")
    return {"id": body["id"], "url": body["url"]}


def sign_payload(raw: bytes, secret: str, timestamp: int | None = None) -> str:
    """How Stripe signs a webhook body. Used by tests and documented here."""
    t = int(time.time()) if timestamp is None else timestamp
    sig = hmac.new(secret.encode("utf-8"), f"{t}.".encode("ascii") + raw, hashlib.sha256).hexdigest()
    return f"t={t},v1={sig}"


def verify_signature(
    raw: bytes, header: str | None, secret: str, tolerance: int = 300, now: float | None = None
) -> dict[str, Any]:
    if not header:
        raise AccountError("invalid", "Missing Stripe-Signature header.")
    parts = [p.strip().split("=", 1) for p in header.split(",") if "=" in p]
    t = next((v for k, v in parts if k == "t"), None)
    sigs = [v for k, v in parts if k == "v1"]
    if not t or not t.isdigit() or not sigs:
        raise AccountError("invalid", "Malformed Stripe-Signature header.")
    if abs(int(now if now is not None else time.time()) - int(t)) > tolerance:
        raise AccountError("invalid", "Stripe signature timestamp is outside the tolerance window.")
    expected = hmac.new(secret.encode("utf-8"), f"{t}.".encode("ascii") + raw, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(s, expected) for s in sigs):
        raise AccountError("invalid", "Stripe signature does not match.")
    try:
        event = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise AccountError("invalid", "Webhook body is not JSON.") from exc
    if not isinstance(event, dict) or not isinstance(event.get("id"), str) or not isinstance(event.get("type"), str):
        raise AccountError("invalid", "Webhook body is not a Stripe event.")
    if not isinstance((event.get("data") or {}).get("object"), dict):
        raise AccountError("invalid", "Webhook body is not a Stripe event.")
    return event


def _s(v: Any) -> str | None:
    return v if isinstance(v, str) and v else None


def _n(v: Any) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def _meta(o: dict[str, Any]) -> dict[str, Any]:
    m = o.get("metadata")
    return m if isinstance(m, dict) else {}


def _ts(sec: int) -> str:
    return _iso(datetime.fromtimestamp(sec, tz=timezone.utc))


def handle_event(store: Store, event: dict[str, Any], expect_livemode: bool) -> dict[str, str]:
    """Applies a verified event exactly once. Raises on failure so the caller answers 500 and Stripe retries."""
    event_id = event["id"]
    if not all(c.isalnum() or c in "_-" for c in event_id) or len(event_id) > 64:
        return {"status": "ignored", "detail": "Event id is not usable as a key."}
    if store.get(K_EVENTS, event_id):
        return {"status": "duplicate", "detail": "Already processed."}
    if bool(event.get("livemode")) != expect_livemode:
        return {"status": "ignored", "detail": f"Event livemode={bool(event.get('livemode'))} does not match this deployment."}
    if not store.put_new(K_LOCKS, event_id, {"at": _iso(now_utc())}, ttl=60):
        return {"status": "in_progress", "detail": "Another delivery is processing this event."}
    try:
        result = _apply(store, event)
        store.put(K_EVENTS, event_id, {"type": event["type"], "at": _iso(now_utc()), "result": result["status"]}, ttl=90 * 86400)
        return result
    finally:
        store.delete(K_LOCKS, event_id)


def _by_customer(store: Store, customer: str | None) -> str | None:
    if not customer or not all(c.isalnum() or c == "_" for c in customer) or len(customer) > 64:
        return None
    row = store.get(K_CUSTOMERS, customer)
    return _s(row.get("user_id")) if row else None


def _user(store: Store, user_id: str | None) -> dict[str, Any] | None:
    if not user_id or not all(c.isalnum() or c == "_" for c in user_id) or len(user_id) > 64:
        return None
    return store.get(K_USERS, user_id)


def _link_customer(store: Store, customer: str, user_id: str) -> None:
    if all(c.isalnum() or c == "_" for c in customer) and len(customer) <= 64:
        store.put(K_CUSTOMERS, customer, {"user_id": user_id})


def _apply(store: Store, event: dict[str, Any]) -> dict[str, str]:
    o: dict[str, Any] = event["data"]["object"]
    at = _ts(_n(event.get("created")) or int(time.time()))
    kind = event["type"]

    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        user = _user(store, _s(_meta(o).get("userId")) or _s(o.get("client_reference_id")))
        session_id = _s(o.get("id"))
        if not user or not session_id or _meta(o).get("product") != "consumer-pro":
            return {"status": "ignored", "detail": "Checkout session does not name a known account and the Pro product."}
        if o.get("payment_status") not in ("paid", "no_payment_required"):
            store.put(K_CHECKOUTS, session_id, {"status": "pending", "user_id": user["id"]})
            return {"status": "processed", "detail": "Checkout completed; payment still pending."}
        ent = read_entitlements(store, user["id"])
        prior = ent.get("subscription") or {}
        ent["plan"] = "pro"
        ent["subscription"] = {
            "id": _s(o.get("subscription")) or prior.get("id"),
            "customer_id": _s(o.get("customer")) or prior.get("customer_id"),
            "status": "active",
            "current_period_end": prior.get("current_period_end"),
            "cancel_at_period_end": False,
            "last_paid_at": at,
            "refunded_at": None,
        }
        record_payment(
            ent,
            {
                "id": session_id,
                "kind": "checkout",
                "product": "consumer-pro",
                "status": "paid",
                "amount": _n(o.get("amount_total")),
                "currency": _s(o.get("currency")),
                "at": at,
            },
        )
        write_entitlements(store, user["id"], ent)
        if ent["subscription"]["customer_id"]:
            _link_customer(store, ent["subscription"]["customer_id"], user["id"])
        store.put(K_CHECKOUTS, session_id, {"status": "paid", "user_id": user["id"]})
        return {"status": "processed", "detail": "Granted Pro."}

    if kind in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        session_id = _s(o.get("id"))
        if not session_id:
            return {"status": "ignored", "detail": "No session id."}
        expired = kind.endswith("expired")
        user = _user(store, _s(_meta(o).get("userId")) or _s(o.get("client_reference_id")))
        store.put(
            K_CHECKOUTS, session_id, {"status": "expired" if expired else "failed", "user_id": user["id"] if user else None}
        )
        if user:
            ent = read_entitlements(store, user["id"])
            record_payment(
                ent,
                {
                    "id": session_id,
                    "kind": "checkout",
                    "product": "consumer-pro",
                    "status": "expired" if expired else "failed",
                    "amount": _n(o.get("amount_total")),
                    "currency": _s(o.get("currency")),
                    "at": at,
                },
            )
            write_entitlements(store, user["id"], ent)
        return {"status": "processed", "detail": "Recorded the failed or abandoned checkout. Nothing was granted."}

    if kind in ("customer.subscription.updated", "customer.subscription.deleted"):
        user = _user(store, _s(_meta(o).get("userId")) or _by_customer(store, _s(o.get("customer"))))
        if not user:
            return {"status": "ignored", "detail": "Subscription does not name a known account."}
        ent = read_entitlements(store, user["id"])
        prior = ent.get("subscription") or {}
        deleted = kind.endswith("deleted")
        status = "canceled" if deleted else (_s(o.get("status")) or "incomplete")
        period_end = _n(o.get("current_period_end"))
        if deleted:
            end = _ts(_n(o.get("ended_at")) or _n(event.get("created")) or int(time.time()))
        else:
            end = _ts(period_end) if period_end is not None else prior.get("current_period_end")
        ent["subscription"] = {
            **prior,
            "id": _s(o.get("id")) or prior.get("id"),
            "customer_id": _s(o.get("customer")) or prior.get("customer_id"),
            "status": status,
            "current_period_end": end,
            "cancel_at_period_end": (not deleted) and o.get("cancel_at_period_end") is True,
        }
        ent["plan"] = "pro" if status in ("active", "trialing") else "free"
        write_entitlements(store, user["id"], ent)
        tail = ", ending at the period end" if ent["subscription"]["cancel_at_period_end"] else ""
        return {"status": "processed", "detail": f"Subscription is {status}{tail}."}

    if kind in ("invoice.paid", "invoice.payment_failed"):
        details = o.get("subscription_details") if isinstance(o.get("subscription_details"), dict) else {}
        user = _user(
            store, _s(_meta(details).get("userId")) or _s(_meta(o).get("userId")) or _by_customer(store, _s(o.get("customer")))
        )
        if not user:
            return {"status": "ignored", "detail": "Invoice does not name a known account."}
        ent = read_entitlements(store, user["id"])
        paid = kind == "invoice.paid"
        record_payment(
            ent,
            {
                "id": _s(o.get("id")) or event["id"],
                "kind": "invoice",
                "product": "consumer-pro",
                "status": "paid" if paid else "failed",
                "amount": _n(o.get("amount_paid") if paid else o.get("amount_due")),
                "currency": _s(o.get("currency")),
                "at": at,
            },
        )
        sub = ent.get("subscription")
        if sub:
            if paid:
                sub["last_paid_at"] = at
                if sub.get("status") == "past_due":
                    sub["status"] = "active"
                period_end = _n(o.get("period_end"))
                current = _parse(sub.get("current_period_end"))
                if period_end is not None and (current is None or current.timestamp() < period_end):
                    sub["current_period_end"] = _ts(period_end)
            else:
                sub["status"] = "past_due"
        ent["plan"] = "pro" if sub and sub.get("status") == "active" else "free"
        write_entitlements(store, user["id"], ent)
        return {
            "status": "processed",
            "detail": "Invoice paid." if paid else "Payment failed; Pro is paused until the card is updated.",
        }

    if kind == "charge.refunded":
        customer = _s(o.get("customer"))
        user = _user(store, _s(_meta(o).get("userId")) or _by_customer(store, customer))
        if not user:
            return {"status": "ignored", "detail": "Refund does not name a known account."}
        ent = read_entitlements(store, user["id"])
        sub = ent.get("subscription")
        if customer and sub and sub.get("customer_id") and sub["customer_id"] != customer:
            return {"status": "ignored", "detail": "Refund customer does not match this account."}
        full = o.get("refunded") is True
        record_payment(
            ent,
            {
                "id": _s(o.get("id")) or event["id"],
                "kind": "refund",
                "product": "consumer-pro",
                "status": "refunded" if full else "partially_refunded",
                "amount": _n(o.get("amount_refunded")),
                "currency": _s(o.get("currency")),
                "at": at,
            },
        )
        if full and sub:
            # A fully refunded payment ends the access it paid for. The next paid invoice restores it.
            sub["refunded_at"] = at
            ent["plan"] = "free"
        write_entitlements(store, user["id"], ent)
        return {
            "status": "processed",
            "detail": "Refunded; Pro access ended." if full else "Partial refund recorded; access unchanged.",
        }

    return {"status": "ignored", "detail": f"Event type {kind} is not handled."}


def checkout_status(store: Store, user_id: str, session_id: str) -> str:
    row = store.get(K_CHECKOUTS, session_id)
    if not row or row.get("user_id") != user_id:
        return "unknown"
    return str(row.get("status", "unknown"))


def create_portal(cfg: BillingConfig, customer_id: str, transport: Transport | None = None) -> str:
    """A Stripe customer-portal link where the person cancels, resumes or updates their card.

    Needs the portal to be configured once in the Stripe dashboard (test mode has its own settings).
    Changes made there reach this app through the subscription webhooks.
    """
    if not cfg.enabled or not cfg.secret_key:
        raise AccountError("unavailable", cfg.reason)
    status, body = (transport or _urllib_transport)(
        "https://api.stripe.com/v1/billing_portal/sessions",
        {"Authorization": f"Bearer {cfg.secret_key}", "Content-Type": "application/x-www-form-urlencoded"},
        urllib.parse.urlencode({"customer": customer_id, "return_url": f"{cfg.app_url}/app/subscription"}).encode("ascii"),
    )
    if status != 200 or not body.get("url"):
        error = body.get("error")
        message = error.get("message") if isinstance(error, dict) else None
        raise AccountError("unavailable", f"Stripe did not open the billing portal{': ' + message if message else ''}.")
    return str(body["url"])
