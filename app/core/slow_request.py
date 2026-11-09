"""Slow-request logging + Server-Timing (OTel-ready without extra deps)."""
from __future__ import annotations

import logging
import os
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from app.core.request_id import request_id_for

_log = logging.getLogger("app.slow_request")
_SLOW_MS = float(os.getenv("SLOW_REQUEST_MS", "800"))


class SlowRequestMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000.0
        rid = request_id_for(request)
        response.headers.setdefault("Server-Timing", f"app;dur={ms:.2f}")
        if ms >= _SLOW_MS:
            _log.warning(
                "slow_request method=%s path=%s ms=%.1f request_id=%s",
                request.method,
                request.url.path,
                ms,
                rid,
            )
        return response
