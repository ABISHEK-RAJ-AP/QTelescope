"""Request correlation IDs for support and structured API errors."""
from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


def request_id_for(req: Request) -> str:
    return getattr(req.state, "request_id", "") or ""


class RequestIdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        incoming = (request.headers.get("x-request-id") or "").strip()
        rid = incoming if incoming else f"req-{uuid.uuid4().hex[:16]}"
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        return response
