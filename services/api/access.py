"""Optional launch gate: waitlist or access code. Default is off."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

AccessMode = Literal["off", "waitlist", "code"]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class WaitlistRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    source: str = Field(default="web", max_length=64)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_RE.match(email):
            raise ValueError("Enter a valid email address")
        return email


class UnlockRequest(BaseModel):
    code: str = Field(min_length=1, max_length=64)


def access_mode() -> AccessMode:
    raw = (os.environ.get("FIT_ACCESS_GATE") or os.environ.get("NEXT_PUBLIC_FIT_ACCESS_GATE") or "off").strip().lower()
    if raw in {"waitlist", "code", "off"}:
        return raw  # type: ignore[return-value]
    return "off"


def access_note() -> str:
    return (os.environ.get("FIT_WAITLIST_NOTE") or "").strip()


def access_codes() -> set[str]:
    raw = os.environ.get("FIT_ACCESS_CODES") or os.environ.get("NEXT_PUBLIC_FIT_ACCESS_CODES") or ""
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def waitlist_path() -> Path:
    return Path(os.environ.get("FIT_WAITLIST_PATH") or "/tmp/aifit-waitlist.jsonl")


def redact_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not local or not domain:
        return "***"
    host, _, tld = domain.partition(".")
    hidden_host = f"{host[:1]}***" if host else "***"
    suffix = f".{tld}" if tld else ""
    return f"{local[:1]}***@{hidden_host}{suffix}"


def append_waitlist(email: str, source: str) -> dict[str, Any]:
    row = {
        "id": str(uuid.uuid4()),
        "email": email,
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    path = waitlist_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row) + "\n")
    return row


def read_waitlist() -> list[dict[str, Any]]:
    path = waitlist_path()
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(raw, dict) and raw.get("email"):
            rows.append(raw)
    return rows


def code_is_valid(code: str) -> bool:
    allowed = access_codes()
    if not allowed:
        return False
    return code.strip().lower() in allowed
