"""Operator alerts for the AI Fit API: same rules as packages/platform/src/alerts.ts.

Off until ALERT_WEBHOOK_URL (HTTPS; Slack, Discord or any JSON endpoint) and/or
ALERT_EMAIL is set. One alert per kind per throttle window, details scrubbed of
email addresses and key-shaped strings, and sending never raises.
"""

from __future__ import annotations

import json
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Protocol

from . import mailer

AlertKind = Literal["server_error", "webhook_failed", "checkout_failed", "portal_failed"]
THROTTLE_SECONDS = 15 * 60
APP = "ai-fit"

_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_SCRUB = [
    (re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+"), "[email]"),
    (re.compile(r"\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+"), "[key]"),
    (re.compile(r"\bwhsec_[A-Za-z0-9]+"), "[key]"),
    (re.compile(r"\bsk-ant-[A-Za-z0-9_-]+"), "[key]"),
    (re.compile(r"\bre_[A-Za-z0-9_]{16,}"), "[key]"),
    (re.compile(r"\bBearer\s+\S+", re.IGNORECASE), "Bearer [key]"),
    (re.compile(r"\b[A-Za-z0-9_-]{40,}\b"), "[token]"),
]


@dataclass(frozen=True)
class AlertConfig:
    enabled: bool
    webhook_url: str | None
    email: str | None
    environment: str
    throttle_seconds: int = THROTTLE_SECONDS


def alert_config(env: dict[str, str | None]) -> AlertConfig:
    url = (env.get("ALERT_WEBHOOK_URL") or "").strip()
    webhook = url if url.startswith("https://") else None
    mail = (env.get("ALERT_EMAIL") or "").strip()
    email = mail if _EMAIL.match(mail) else None
    environment = env.get("VERCEL_ENV") or "development"
    return AlertConfig(bool(webhook or email), webhook, email, environment)


def scrub(text: str) -> str:
    for pattern, replacement in _SCRUB:
        text = pattern.sub(replacement, text)
    return text[:500]


class Store(Protocol):
    def put_new(self, kind: str, key: str, payload: dict[str, Any], ttl: int | None = None) -> bool: ...


_memory: dict[str, float] = {}


def _claim(store: Store | None, key: str, ttl: int) -> bool:
    if store is not None:
        try:
            return store.put_new("alerts", key, {"at": time.time()}, ttl=ttl)
        except Exception:  # noqa: BLE001 - fall back to the per-instance throttle
            pass
    now = time.time()
    if _memory.get(key, 0) > now:
        return False
    _memory[key] = now + ttl
    return True


Transport = Callable[[str, dict[str, str], bytes], int]


def raise_alert(
    cfg: AlertConfig,
    store: Store | None,
    kind: AlertKind,
    detail: str,
    env: dict[str, str | None] | None = None,
    transport: Transport | None = None,
) -> bool:
    """Send one alert if configured and not throttled. Never raises."""
    if not cfg.enabled:
        return False
    try:
        if not _claim(store, f"{APP}-{kind}", cfg.throttle_seconds):
            return False
        clean = scrub(detail)
        at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        title = f"[{APP} {cfg.environment}] {kind.replace('_', ' ')}"
        minutes = round(cfg.throttle_seconds / 60)
        text = f"{title}\n{clean}\n{at}\nFurther alerts of this kind are held for {minutes} minutes."
        send = transport or mailer._transport
        sent = False
        if cfg.webhook_url:
            # `text` is what Slack reads, `content` what Discord reads.
            payload = {"type": "aifit.alert", "app": APP, "kind": kind, "environment": cfg.environment}
            payload.update({"detail": clean, "at": at, "text": text, "content": text})
            status = send(cfg.webhook_url, {"Content-Type": "application/json"}, json.dumps(payload).encode("utf-8"))
            sent = 200 <= status < 300
        if cfg.email:
            mail = mailer.mail_config(env or {})
            sent = mailer.send(mail, cfg.email, title, text, transport=transport) or sent
        return sent
    except Exception:  # noqa: BLE001 - an alert must never break the request that triggered it
        return False
