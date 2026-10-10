"""Durable key-value store for sessions, events, scores, and shares.

Backends, in order of preference:

1. Upstash / Vercel KV REST when the env vars are set (survives serverless).
2. Filesystem under AIFIT_STORE (local and single-instance).

Reads always go to the backend, so separate serverless instances never serve
each other stale copies. Session events live in an append-only list, so two
instances saving answers at once cannot overwrite each other.

On Vercel without Redis/KV, filesystem writes to /tmp are not shared across
instances, so the client still keeps a hash fallback on share links.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None  # type: ignore[assignment]

DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
PURGE_EVERY_N_WRITES = 200
_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class ResultStore:
    def __init__(self) -> None:
        redis_url = os.environ.get("UPSTASH_REDIS_REST_URL") or os.environ.get("KV_REST_API_URL")
        redis_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN") or os.environ.get("KV_REST_API_TOKEN")
        self.redis_url = redis_url.rstrip("/") if redis_url else None
        self.redis_token = redis_token
        self.root = Path(os.environ.get("AIFIT_STORE", "/tmp/aifit-store"))
        self.ttl = DEFAULT_TTL_SECONDS
        self._writes = 0
        self._local_counts: Counter[str] = Counter()
        if self.redis_url and self.redis_token:
            self.backend = "redis"
        else:
            self.backend = "filesystem"

    @property
    def durable(self) -> bool:
        if self.backend == "redis":
            return True
        if os.environ.get("VERCEL"):
            return False
        return True

    @staticmethod
    def _check(kind: str, key: str) -> None:
        if not _KEY_PATTERN.match(kind) or not _KEY_PATTERN.match(key):
            raise ValueError(f"Invalid store key: {kind}/{key}")

    def _key(self, kind: str, key: str) -> str:
        return f"aifit:{kind}:{key}"

    # Documents -----------------------------------------------------------

    def put(self, kind: str, key: str, payload: dict[str, Any], ttl: int | None = None) -> bool:
        self._check(kind, key)
        ttl = ttl or self.ttl
        if self.backend == "redis":
            body = self._redis_cmd("SET", self._key(kind, key), json.dumps(payload), "EX", str(ttl))
            return body is not None
        self._maybe_purge()
        return self._fs_write(self._path(kind, key, "json"), json.dumps(payload))

    def get(self, kind: str, key: str) -> dict[str, Any] | None:
        self._check(kind, key)
        if self.backend == "redis":
            body = self._redis_cmd("GET", self._key(kind, key))
            raw = self._decode(body.get("result") if body else None)
            return raw if isinstance(raw, dict) else None
        text = self._fs_read(self._path(kind, key, "json"))
        raw = self._decode(text)
        return raw if isinstance(raw, dict) else None

    def delete(self, kind: str, key: str) -> None:
        self._check(kind, key)
        if self.backend == "redis":
            self._redis_cmd("DEL", self._key(kind, key))
            return
        for suffix in ("json", "jsonl"):
            try:
                self._path(kind, key, suffix).unlink(missing_ok=True)
            except OSError:
                pass

    # Append-only lists ---------------------------------------------------

    def append(self, kind: str, key: str, items: list[dict[str, Any]], ttl: int | None = None) -> bool:
        """Atomically append items to a list. Safe across instances."""
        self._check(kind, key)
        if not items:
            return True
        ttl = ttl or self.ttl
        if self.backend == "redis":
            name = self._key(kind, key)
            pushed = self._redis_cmd("RPUSH", name, *(json.dumps(item) for item in items))
            self._redis_cmd("EXPIRE", name, str(ttl))
            return pushed is not None
        self._maybe_purge()
        path = self._path(kind, key, "jsonl")
        lines = "".join(json.dumps(item) + "\n" for item in items)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as handle:
                if fcntl:
                    fcntl.flock(handle, fcntl.LOCK_EX)
                handle.write(lines)
            return True
        except OSError:
            return False

    def get_list(self, kind: str, key: str) -> list[dict[str, Any]]:
        self._check(kind, key)
        if self.backend == "redis":
            body = self._redis_cmd("LRANGE", self._key(kind, key), "0", "-1")
            rows = body.get("result") if body else None
            decoded = [self._decode(row) for row in rows or []]
        else:
            text = self._fs_read(self._path(kind, key, "jsonl"))
            decoded = [self._decode(line) for line in (text or "").splitlines() if line.strip()]
        return [row for row in decoded if isinstance(row, dict)]

    def list_length(self, kind: str, key: str) -> int:
        self._check(kind, key)
        if self.backend == "redis":
            body = self._redis_cmd("LLEN", self._key(kind, key))
            return int(body.get("result") or 0) if body else 0
        return len(self.get_list(kind, key))

    # Counters ------------------------------------------------------------

    def incr(self, name: str) -> None:
        self._check("counter", name)
        if self.backend == "redis":
            self._redis_cmd("INCR", self._key("counter", name))
            return
        self._local_counts[name] += 1

    def count(self, name: str) -> int:
        self._check("counter", name)
        if self.backend == "redis":
            body = self._redis_cmd("GET", self._key("counter", name))
            try:
                return int(body.get("result") or 0) if body else 0
            except (TypeError, ValueError):
                return 0
        return self._local_counts[name]

    # Filesystem helpers ----------------------------------------------------

    def _path(self, kind: str, key: str, suffix: str) -> Path:
        return self.root / kind / f"{key}.{suffix}"

    def _expired(self, path: Path) -> bool:
        try:
            return time.time() - path.stat().st_mtime > self.ttl
        except OSError:
            return True

    def _fs_write(self, path: Path, text: str) -> bool:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
            tmp.write_text(text)
            tmp.replace(path)
            return True
        except OSError:
            return False

    def _fs_read(self, path: Path) -> str | None:
        try:
            if not path.exists():
                return None
            if self._expired(path):
                path.unlink(missing_ok=True)
                return None
            return path.read_text()
        except OSError:
            return None

    def _maybe_purge(self) -> None:
        self._writes += 1
        if self._writes % PURGE_EVERY_N_WRITES == 0:
            self.purge_expired()

    def purge_expired(self) -> int:
        """Delete filesystem records older than the TTL. Redis expires on its own."""
        if self.backend == "redis" or not self.root.exists():
            return 0
        removed = 0
        for path in self.root.glob("*/*"):
            if path.is_file() and self._expired(path):
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    pass
        return removed

    # Redis helpers ---------------------------------------------------------

    @staticmethod
    def _decode(raw: Any) -> Any:
        if not raw:
            return None
        try:
            return json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            return None

    def _redis_cmd(self, *parts: str) -> dict[str, Any] | None:
        if not self.redis_url or not self.redis_token:
            return None
        request = urllib.request.Request(
            self.redis_url,
            data=json.dumps(list(parts)).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.redis_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            return None


STORE = ResultStore()
