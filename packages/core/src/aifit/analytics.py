"""Privacy-conscious analytics. No names, employers, or demographics."""

from __future__ import annotations

from collections import Counter, deque
from datetime import datetime, timezone

MAX_RECENT_EVENTS = 500

_RECENT: deque[dict] = deque(maxlen=MAX_RECENT_EVENTS)
_COUNTS: Counter[str] = Counter()


def track(name: str, *, session_id: str | None = None, metadata: dict | None = None) -> dict:
    event = {
        "name": name,
        "at": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "metadata": metadata or {},
    }
    _RECENT.append(event)
    _COUNTS[name] += 1
    return event


def summary() -> dict:
    return {
        "event_count": sum(_COUNTS.values()),
        "counts": dict(_COUNTS),
        "retention": (
            f"Anonymous in-memory counts for this server process, plus the last {MAX_RECENT_EVENTS} events. "
            "Not written to disk."
        ),
    }


def reset() -> None:
    _RECENT.clear()
    _COUNTS.clear()
