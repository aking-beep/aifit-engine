"""Transactional email, provider-neutral. Resend over plain REST is the first adapter.

Off unless RESEND_API_KEY and EMAIL_FROM are set. Plain text only: no tracking
pixels and no remote images. Sending never raises; it returns False.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

_ADDRESS = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_FROM = re.compile(r"^[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}$|^.+<[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}>$", re.I)
PRODUCT = "AI Fit"


@dataclass(frozen=True)
class MailConfig:
    enabled: bool
    reason: str
    app_url: str
    api_key: str | None = None
    sender: str | None = None
    reply_to: str | None = None


def mail_config(env: dict[str, str | None]) -> MailConfig:
    prod = env.get("VERCEL_PROJECT_PRODUCTION_URL")
    vercel = env.get("VERCEL_URL")
    app_url = (
        env.get("APP_URL") or (f"https://{prod}" if prod else f"https://{vercel}" if vercel else "http://localhost:43123")
    ).rstrip("/")
    key = (env.get("RESEND_API_KEY") or "").strip()
    sender = (env.get("EMAIL_FROM") or "").strip()
    if not key:
        return MailConfig(False, "Email is off (RESEND_API_KEY is not set).", app_url)
    if not _FROM.match(sender):
        return MailConfig(False, "Email is off (EMAIL_FROM is missing or not an address).", app_url)
    return MailConfig(True, "Email is on.", app_url, key, sender, (env.get("EMAIL_REPLY_TO") or "").strip() or None)


Transport = Callable[[str, dict[str, str], bytes], int]


def _transport(url: str, headers: dict[str, str], body: bytes) -> int:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            return res.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except (urllib.error.URLError, TimeoutError, ValueError):
        return 0


def send(
    cfg: MailConfig, to: str, subject: str, text: str, idempotency_key: str | None = None, transport: Transport | None = None
) -> bool:
    if not cfg.enabled or not cfg.api_key or not cfg.sender or not _ADDRESS.match(to or "") or len(to) > 254:
        return False
    payload = {"from": cfg.sender, "to": [to], "subject": subject[:200], "text": text}
    if cfg.reply_to:
        payload["reply_to"] = cfg.reply_to
    headers = {"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key[:256]
    try:
        status = (transport or _transport)("https://api.resend.com/emails", headers, json.dumps(payload).encode("utf-8"))
    except Exception:  # noqa: BLE001 - email must never break the request that triggered it
        return False
    return 200 <= status < 300


def _footer() -> str:
    return f"\n\n—\n{PRODUCT} · ARC Transformation Group\nYou are receiving this because of an action on your account."


def password_reset(link: str, minutes: int) -> tuple[str, str]:
    return (
        f"Reset your {PRODUCT} password",
        f"Someone asked to reset the password for this email address.\n\nTo choose a new password, open this link within "
        f"{minutes} minutes:\n{link}\n\nIf it was not you, ignore this email: your password stays the same.{_footer()}",
    )


def password_changed() -> tuple[str, str]:
    return (
        f"Your {PRODUCT} password was changed",
        f"The password for your {PRODUCT} account was just changed, and every session was signed out.\n\n"
        f"If this was not you, reset your password now and reply to this email.{_footer()}",
    )


def receipt(item: str, amount: str, when: str, manage_url: str) -> tuple[str, str]:
    return (
        f"Receipt: {item}",
        f"Thank you. Stripe confirmed your payment.\n\nItem: {item}\nAmount: {amount}\nDate: {when}\n\n"
        f"Manage your subscription: {manage_url}\nStripe also sends its own receipt with the tax details.{_footer()}",
    )


def lead_notice(summary: str) -> tuple[str, str]:
    return (f"New {PRODUCT} lead", f"{summary}{_footer()}")
