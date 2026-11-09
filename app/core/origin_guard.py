"""Reject cross-site mutating requests when Origin/Referer do not match allowed UI origins."""
from __future__ import annotations

import os
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.env_profile import is_production_profile


def _allowed_origins() -> set[str]:
    raw = (os.getenv("CORS_ORIGINS") or "").strip()
    if not raw or raw == "*":
        return set()
    return {o.strip().rstrip("/") for o in raw.split(",") if o.strip()}


def _origin_from_request(request: Request) -> str | None:
    origin = (request.headers.get("origin") or "").strip()
    if origin:
        return origin.rstrip("/")
    referer = (request.headers.get("referer") or "").strip()
    if not referer:
        return None
    parsed = urlparse(referer)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


class OriginGuardMiddleware(BaseHTTPMiddleware):
    """ponytail: Bearer APIs — blocks drive-by browser CSRF when Origin is sent."""

    async def dispatch(self, request: Request, call_next):
        if not is_production_profile():
            return await call_next(request)
        if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
            return await call_next(request)
        allowed = _allowed_origins()
        if not allowed:
            return await call_next(request)
        origin = _origin_from_request(request)
        if origin is None:
            return await call_next(request)
        if origin not in allowed:
            return JSONResponse(
                status_code=403,
                content={"error": {"code": "ORIGIN_NOT_ALLOWED", "message": "Origin not permitted."}},
            )
        return await call_next(request)
