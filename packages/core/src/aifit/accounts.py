"""Consumer accounts: sign-up, sessions, the saved AI profile, saved items and history.

The rules mirror the Teams platform package (packages/platform):

* Passwords are hashed with scrypt; the parameters travel with the hash.
* A session is a random 256-bit token. Only its SHA-256 is stored, so a
  leaked store does not hand out working sessions.
* Accounts are keyed by an opaque id. The email lookup key is a hash of the
  normalised address, so listing the store does not list emails.
* Nothing here decides what a plan unlocks. That lives in ``aifit.billing``.

Every function takes the store explicitly so it can be tested without the API.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator

SESSION_DAYS = 30
MIN_PASSWORD = 10
MAX_PASSWORD = 200
MAX_SAVED = 200
MAX_HISTORY = 100
LOCK_AFTER_FAILURES = 10
LOCK_MINUTES = 15
SCRYPT = {"n": 2**14, "r": 8, "p": 1}

K_USERS = "acct_users"
K_EMAIL = "acct_email"
K_SESSIONS = "acct_sessions"
K_SAVED = "acct_saved"
K_HISTORY = "acct_history"
K_ENTITLEMENTS = "acct_entitlements"

_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,24}$")


class Store(Protocol):
    def put(self, kind: str, key: str, payload: dict[str, Any], ttl: int | None = None) -> bool: ...
    def put_new(self, kind: str, key: str, payload: dict[str, Any], ttl: int | None = None) -> bool: ...
    def get(self, kind: str, key: str) -> dict[str, Any] | None: ...
    def delete(self, kind: str, key: str) -> None: ...


class AccountError(Exception):
    """A refusal with an HTTP-shaped code: invalid, unauthorized, conflict, locked, not_found, limit."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Enter a valid email address.")
        return v


class SignUp(Credentials):
    name: str = Field(default="", max_length=80)
    password: str = Field(min_length=MIN_PASSWORD, max_length=MAX_PASSWORD)


SavedKind = Literal["tool", "workflow", "config", "comparison"]


class SavedItemInput(BaseModel):
    """Something the person chose to keep. `ref` points at a registry id, a check id or a file name."""

    model_config = ConfigDict(extra="forbid")
    kind: SavedKind
    ref: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_.:/ -]+$")
    label: str = Field(min_length=1, max_length=160)
    note: str = Field(default="", max_length=500)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT["n"], r=SCRYPT["r"], p=SCRYPT["p"], dklen=64, maxmem=64 * 1024 * 1024
    )
    return "$".join(["scrypt", str(SCRYPT["n"]), str(SCRYPT["r"]), str(SCRYPT["p"]), _b64(salt), _b64(key)])


def verify_password(password: str, stored: str) -> bool:
    try:
        alg, n, r, p, salt, digest = stored.split("$")
        if alg != "scrypt":
            return False
        expected = _unb64(digest)
        key = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_unb64(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
            maxmem=64 * 1024 * 1024,
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(key, expected)


def email_key(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:48]


def token_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:64]


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


# Users and sessions ----------------------------------------------------------


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {"id": user["id"], "email": user["email"], "name": user.get("name", ""), "created_at": user["created_at"]}


def _start_session(store: Store, user_id: str, at: datetime) -> str:
    token = secrets.token_urlsafe(32)
    store.put(
        K_SESSIONS,
        token_key(token),
        {"user_id": user_id, "created_at": _iso(at), "expires_at": _iso(at + timedelta(days=SESSION_DAYS))},
        ttl=SESSION_DAYS * 86400,
    )
    return token


def sign_up(store: Store, data: SignUp, at: datetime | None = None) -> tuple[dict[str, Any], str]:
    at = at or now_utc()
    user_id = _new_id("usr")
    if not store.put_new(K_EMAIL, email_key(data.email), {"user_id": user_id}):
        raise AccountError("conflict", "An account with that email already exists. Sign in instead.")
    user = {
        "id": user_id,
        "email": data.email,
        "name": data.name.strip(),
        "password": hash_password(data.password),
        "created_at": _iso(at),
        "failed_logins": 0,
        "locked_until": None,
    }
    store.put(K_USERS, user_id, user)
    return user, _start_session(store, user_id, at)


def sign_in(store: Store, data: Credentials, at: datetime | None = None) -> tuple[dict[str, Any], str]:
    at = at or now_utc()
    # One message for unknown email and wrong password, so sign-in does not confirm who has an account.
    wrong = AccountError("unauthorized", "Email or password is wrong.")
    link = store.get(K_EMAIL, email_key(data.email))
    user = store.get(K_USERS, link["user_id"]) if link else None
    if not user:
        verify_password(data.password, hash_password("timing-equaliser"))
        raise wrong
    locked = _parse(user.get("locked_until"))
    if locked and locked > at:
        raise AccountError("locked", "Too many failed attempts. Try again in a few minutes.")
    if not verify_password(data.password, user["password"]):
        user["failed_logins"] = int(user.get("failed_logins") or 0) + 1
        if user["failed_logins"] >= LOCK_AFTER_FAILURES:
            user["locked_until"] = _iso(at + timedelta(minutes=LOCK_MINUTES))
            user["failed_logins"] = 0
        store.put(K_USERS, user["id"], user)
        raise wrong
    if user.get("failed_logins") or user.get("locked_until"):
        user["failed_logins"] = 0
        user["locked_until"] = None
        store.put(K_USERS, user["id"], user)
    return user, _start_session(store, user["id"], at)


def sign_out(store: Store, token: str | None) -> None:
    if token:
        store.delete(K_SESSIONS, token_key(token))


def current_user(store: Store, token: str | None, at: datetime | None = None) -> dict[str, Any] | None:
    if not token or len(token) > 200:
        return None
    session = store.get(K_SESSIONS, token_key(token))
    if not session:
        return None
    expires = _parse(session.get("expires_at"))
    if not expires or expires <= (at or now_utc()):
        store.delete(K_SESSIONS, token_key(token))
        return None
    return store.get(K_USERS, session["user_id"])


def require_user(store: Store, token: str | None) -> dict[str, Any]:
    user = current_user(store, token)
    if not user:
        raise AccountError("unauthorized", "Sign in to use your account.")
    return user


def update_name(store: Store, user: dict[str, Any], name: str) -> dict[str, Any]:
    user["name"] = name.strip()[:80]
    store.put(K_USERS, user["id"], user)
    return user


def change_password(store: Store, user: dict[str, Any], current: str, new: str) -> None:
    if not verify_password(current, user["password"]):
        raise AccountError("unauthorized", "Current password is wrong.")
    if not (MIN_PASSWORD <= len(new) <= MAX_PASSWORD):
        raise AccountError("invalid", f"Use at least {MIN_PASSWORD} characters.")
    user["password"] = hash_password(new)
    store.put(K_USERS, user["id"], user)


# Profile and history ---------------------------------------------------------


def _doc(store: Store, kind: str, user_id: str) -> dict[str, Any]:
    return store.get(kind, user_id) or {"items": []}


def save_assessment(
    store: Store, user: dict[str, Any], result: dict[str, Any], source: str, label: str, at: datetime | None = None
) -> dict[str, Any]:
    """Keep a scored result as the account's current AI profile and add it to history."""
    at = at or now_utc()
    entry = {"id": _new_id("asm"), "source": source[:120], "label": label[:160], "saved_at": _iso(at), "result": result}
    doc = _doc(store, K_HISTORY, user["id"])
    doc["items"] = ([entry] + doc["items"])[:MAX_HISTORY]
    store.put(K_HISTORY, user["id"], doc)
    return entry


def history(store: Store, user_id: str) -> list[dict[str, Any]]:
    return list(_doc(store, K_HISTORY, user_id)["items"])


def latest_profile(store: Store, user_id: str) -> dict[str, Any] | None:
    items = history(store, user_id)
    return items[0] if items else None


def delete_history_entry(store: Store, user_id: str, entry_id: str) -> bool:
    doc = _doc(store, K_HISTORY, user_id)
    before = len(doc["items"])
    doc["items"] = [e for e in doc["items"] if e.get("id") != entry_id]
    store.put(K_HISTORY, user_id, doc)
    return len(doc["items"]) < before


# Saved items -----------------------------------------------------------------


def saved(store: Store, user_id: str) -> list[dict[str, Any]]:
    return list(_doc(store, K_SAVED, user_id)["items"])


def add_saved(store: Store, user_id: str, item: SavedItemInput, limit: int | None, at: datetime | None = None) -> dict[str, Any]:
    doc = _doc(store, K_SAVED, user_id)
    for existing in doc["items"]:
        if existing["kind"] == item.kind and existing["ref"] == item.ref:
            return existing
    cap = MAX_SAVED if limit is None else min(limit, MAX_SAVED)
    if len(doc["items"]) >= cap:
        raise AccountError("limit", f"You can keep {cap} saved items on this plan.")
    row = {"id": _new_id("sav"), **item.model_dump(), "saved_at": _iso(at or now_utc())}
    doc["items"] = [row] + doc["items"]
    store.put(K_SAVED, user_id, doc)
    return row


def remove_saved(store: Store, user_id: str, item_id: str) -> bool:
    doc = _doc(store, K_SAVED, user_id)
    before = len(doc["items"])
    doc["items"] = [r for r in doc["items"] if r.get("id") != item_id]
    store.put(K_SAVED, user_id, doc)
    return len(doc["items"]) < before


# Export and deletion ---------------------------------------------------------


def export_account(store: Store, user: dict[str, Any]) -> dict[str, Any]:
    ent = store.get(K_ENTITLEMENTS, user["id"]) or {}
    return {
        "account": public_user(user),
        "history": history(store, user["id"]),
        "saved": saved(store, user["id"]),
        "billing": {k: ent.get(k) for k in ("plan", "subscription", "payments") if k in ent},
        "notice": "Everything this account stores. The password hash and session tokens are left out.",
    }


def delete_account(store: Store, user: dict[str, Any], token: str | None) -> None:
    """Removes the account and everything stored under it. Stripe keeps its own records of past payments."""
    for kind in (K_HISTORY, K_SAVED, K_ENTITLEMENTS):
        store.delete(kind, user["id"])
    store.delete(K_EMAIL, email_key(user["email"]))
    store.delete(K_USERS, user["id"])
    sign_out(store, token)
