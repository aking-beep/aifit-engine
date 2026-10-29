"""Leads from the "Get a follow-up from ARC" form on AI Fit.

Same shape and rules as the Teams platform (packages/platform/src/leads.ts):
stored for the operator only, optionally forwarded to a CRM as a webhook
signed `t=<unix>,v1=<HMAC-SHA256>`, exported with a bearer token.
"""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import secrets
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator

K_LEAD = "acct_leads"
K_INDEX = "acct_lead_index"
INDEX_KEY = "all"

_TOKEN = r"^[\w.\-~ +:/@]*$"


class _Attribution(BaseModel):
    model_config = ConfigDict(extra="forbid")
    utm: dict[Literal["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"], str] = Field(default_factory=dict)
    clickIds: dict[Literal["gclid", "fbclid", "li_fat_id", "msclkid"], str] = Field(default_factory=dict)
    landingPath: str = Field(default="/", max_length=200)
    referrerHost: str | None = Field(default=None, max_length=200)
    firstSeenAt: str = Field(max_length=40)

    @field_validator("utm", "clickIds")
    @classmethod
    def _values(cls, v: dict[str, str]) -> dict[str, str]:
        import re

        for value in v.values():
            if len(value) > 120 or not re.match(_TOKEN, value):
                raise ValueError("Bad campaign value.")
        return v


class _Source(BaseModel):
    model_config = ConfigDict(extra="forbid")
    app: Literal["ai-fit", "ai-fit-teams"]
    page: str = Field(max_length=120, pattern=r"^[\w\-/]*$")
    attribution: _Attribution | None = None


class LeadInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    name: str | None = Field(default=None, max_length=100)
    company: str | None = Field(default=None, max_length=120)
    role: str | None = Field(default=None, max_length=100)
    interest: Literal["assessment", "blueprint", "workspace", "advisory", "personal", "other"]
    message: str | None = Field(default=None, max_length=1000)
    consent: Literal[True]
    website: str | None = Field(default=None, max_length=200)
    source: _Source

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v: Any) -> Any:
        return v.strip().lower() if isinstance(v, str) else v


class Store(Protocol):
    def put(self, kind: str, key: str, payload: dict[str, Any], ttl: int | None = None) -> bool: ...
    def get(self, kind: str, key: str) -> dict[str, Any] | None: ...
    def append(self, kind: str, key: str, items: list[dict[str, Any]], ttl: int | None = None) -> bool: ...
    def get_list(self, kind: str, key: str) -> list[dict[str, Any]]: ...


def to_record(lead: LeadInput, user_id: str | None, at: datetime | None = None) -> dict[str, Any]:
    at = at or datetime.now(timezone.utc)
    when = at.isoformat().replace("+00:00", "Z")
    data = lead.model_dump(exclude={"website", "consent"}, exclude_none=True)
    return {**data, "id": f"lead_{secrets.token_hex(8)}", "receivedAt": when, "consentAt": when, "userId": user_id}


def save(store: Store, record: dict[str, Any]) -> None:
    store.put(K_LEAD, record["id"], record)
    store.append(K_INDEX, INDEX_KEY, [{"id": record["id"]}])


def recent(store: Store, limit: int = 2000) -> list[dict[str, Any]]:
    ids = [row.get("id") for row in store.get_list(K_INDEX, INDEX_KEY)][-limit:]
    rows = [store.get(K_LEAD, i) for i in reversed(ids) if isinstance(i, str)]
    return [r for r in rows if r]


def authorize_export(header: str | None, expected: str | None) -> bool | None:
    """None: export is off. False: wrong token. True: allowed."""
    if not expected or len(expected) < 24:
        return None
    got = header[7:] if header and header.startswith("Bearer ") else ""
    return hmac.compare_digest(got, expected)


_COLS = [
    "receivedAt",
    "email",
    "name",
    "company",
    "role",
    "interest",
    "message",
    "app",
    "page",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "referrerHost",
]


def to_csv(rows: list[dict[str, Any]]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(_COLS)
    for r in rows:
        attr = (r.get("source") or {}).get("attribution") or {}
        utm = attr.get("utm") or {}
        values = [
            r.get("receivedAt"),
            r.get("email"),
            r.get("name"),
            r.get("company"),
            r.get("role"),
            r.get("interest"),
            r.get("message"),
            (r.get("source") or {}).get("app"),
            (r.get("source") or {}).get("page"),
            utm.get("utm_source"),
            utm.get("utm_medium"),
            utm.get("utm_campaign"),
            utm.get("utm_content"),
            attr.get("referrerHost"),
        ]
        # Spreadsheet formula injection: a cell starting with = + - @ is prefixed with a quote.
        writer.writerow([("'" + str(v)) if isinstance(v, str) and v[:1] in "=+-@" else ("" if v is None else v) for v in values])
    return out.getvalue()


def sign(body: bytes, secret: str, t: int | None = None) -> str:
    ts = int(time.time()) if t is None else t
    sig = hmac.new(secret.encode("utf-8"), f"{ts}.".encode("ascii") + body, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


Transport = Callable[[str, dict[str, str], bytes], int]


def _transport(url: str, headers: dict[str, str], body: bytes) -> int:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except (urllib.error.URLError, TimeoutError, ValueError):
        return 0


def forward(url: str | None, secret: str | None, record: dict[str, Any], transport: Transport | None = None) -> bool:
    """Never raises, so a CRM outage does not lose the lead. HTTPS only."""
    if not url or not url.startswith("https://"):
        return False
    body = json.dumps({"type": "lead.created", "lead": record}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["X-AIFit-Signature"] = sign(body, secret)
    try:
        status = (transport or _transport)(url, headers, body)
    except Exception:  # noqa: BLE001
        return False
    return 200 <= status < 300


def summary(record: dict[str, Any]) -> str:
    attr = (record.get("source") or {}).get("attribution") or {}
    utm = attr.get("utm") or {}
    lines = [f"Email: {record.get('email')}"]
    for label, key in (("Name", "name"), ("Company", "company"), ("Role", "role")):
        if record.get(key):
            lines.append(f"{label}: {record[key]}")
    lines.append(f"Interest: {record.get('interest')}")
    if record.get("message"):
        lines.append(f"Message: {record['message']}")
    lines.append(f"Page: {(record.get('source') or {}).get('app')}/{(record.get('source') or {}).get('page')}")
    if utm.get("utm_source"):
        lines.append(f"Campaign: {utm.get('utm_source')} / {utm.get('utm_medium', '-')} / {utm.get('utm_campaign', '-')}")
    return "\n".join(lines)
