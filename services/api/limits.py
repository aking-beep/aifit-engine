"""MVP request limits and browser security headers. Best-effort on serverless."""

from __future__ import annotations

import os
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimiter:
    def __init__(self) -> None:
        self.hits: dict[str, list[float]] = defaultdict(list)

    def reset(self) -> None:
        self.hits.clear()

    def allow(self, key: str, limit: int, window_seconds: float = 60.0) -> bool:
        if limit <= 0:
            return True
        now = time.monotonic()
        bucket = [stamp for stamp in self.hits[key] if now - stamp < window_seconds]
        if len(bucket) >= limit:
            self.hits[key] = bucket
            return False
        bucket.append(now)
        self.hits[key] = bucket
        return True


LIMITER = RateLimiter()


def rate_limit_per_minute() -> int:
    raw = os.environ.get("FIT_RATE_LIMIT_PER_MINUTE", "180")
    try:
        return int(raw)
    except ValueError:
        return 180


def waitlist_rate_limit_per_minute() -> int:
    raw = os.environ.get("FIT_WAITLIST_RATE_LIMIT_PER_MINUTE", "8")
    try:
        return int(raw)
    except ValueError:
        return 8


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if request.method == "GET" and path in {"/health", "/v1/access"}:
            return await call_next(request)
        ip = client_ip(request)
        general = rate_limit_per_minute()
        if not LIMITER.allow(f"ip:{ip}", general):
            return JSONResponse({"detail": "Too many requests. Wait a minute and try again."}, status_code=429)
        if request.method == "POST" and path == "/v1/waitlist":
            if not LIMITER.allow(f"waitlist:{ip}", waitlist_rate_limit_per_minute()):
                return JSONResponse({"detail": "Waitlist is temporarily full. Try again shortly."}, status_code=429)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("X-Robots-Tag", "noindex")
        return response


def cors_origins() -> list[str]:
    raw = os.environ.get("FIT_CORS_ORIGINS", "").strip()
    if raw:
        return [part.strip().rstrip("/") for part in raw.split(",") if part.strip()]
    origins = [
        "http://127.0.0.1:43123",
        "http://localhost:43123",
        "https://aifit-engine.vercel.app",
    ]
    site = (os.environ.get("NEXT_PUBLIC_SITE_URL") or "").strip().rstrip("/")
    if site and site not in origins:
        origins.append(site)
    return origins


def operator_authorized(request: Request) -> bool:
    expected = (os.environ.get("FIT_OPERATOR_KEY") or "").strip()
    if not expected:
        return False
    offered = request.headers.get("x-fit-operator-key") or ""
    if offered.startswith("Bearer "):
        offered = offered[7:]
    return offered == expected
