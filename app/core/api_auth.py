"""Optional global API authentication middleware."""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.request_id import request_id_for
from app.core.sessions import get_session, require_api_auth

_PUBLIC_SUFFIXES = (
    "/auth/login",
    "/auth/login/mfa",
    "/auth/register",
    "/auth/captcha",
    "/auth/config-status",
    "/auth/verify-captcha",
    "/auth/password/forgot",
    "/auth/password/reset",
)


def _is_public_path(path: str) -> bool:
    if path in ("/", "/docs", "/redoc", "/openapi.json", "/healthz", "/readyz"):
        return True
    prefix = settings.API_V1_STR
    if not path.startswith(prefix):
        return path.startswith("/docs") or path.startswith("/redoc")
    rest = path[len(prefix) :]
    return any(rest == suf or rest.startswith(suf + "/") for suf in _PUBLIC_SUFFIXES)


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    if request.url.path.endswith("/events/stream"):
        from app.core.stream_tickets import resolve_stream_ticket
        from app.core.env_profile import is_production_profile

        ticket = (request.query_params.get("stream_ticket") or "").strip()
        if ticket:
            return resolve_stream_ticket(ticket)
        legacy = (request.query_params.get("access_token") or "").strip()
        if legacy and not is_production_profile():
            return legacy
        return None
    return None


class ApiAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        if not require_api_auth() or _is_public_path(request.url.path):
            return await call_next(request)
        token = _extract_token(request)
        session = get_session(token) if token else None
        if not session:
            rid = request_id_for(request)
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "AUTH_REQUIRED",
                        "message": "Authentication required. Send Authorization: Bearer <session token>.",
                        "request_id": rid,
                    }
                },
                headers={"X-Request-Id": rid},
            )
        request.state.session = session
        request.state.username = session.get("username")
        request.state.role = session.get("role")
        from app.core.tenant import tenant_from_session_record

        request.state.tenant_id = tenant_from_session_record(session)
        return await call_next(request)
