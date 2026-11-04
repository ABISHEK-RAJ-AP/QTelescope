"""HTTP security headers for VAPT / production hardening."""
from __future__ import annotations

import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


def _is_production() -> bool:
    profile = (os.getenv("QRE_PROFILE") or os.getenv("ENVIRONMENT") or "").lower().strip()
    return profile in ("prod", "production")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add baseline headers. Does not replace a full reverse-proxy CSP policy."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._prod = _is_production()

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()",
        )
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        # API JSON — avoid MIME sniffing and discourage embedding
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if self._prod:
            # HSTS only when TLS terminates in front; harmless over HTTP for lab VMs
            if request.headers.get("x-forwarded-proto", "").lower() == "https" or request.url.scheme == "https":
                response.headers.setdefault(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains",
                )
        return response
