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
        from app.core.log_context import request_id_ctx

        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers["X-Request-Id"] = rid
        return response
