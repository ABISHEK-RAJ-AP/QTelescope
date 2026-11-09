from __future__ import annotations

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.write_rate_limit import check_write_rate_limit
from app.core.env_profile import env_flag


class WriteRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not env_flag("API_WRITE_RATE_LIMIT_ENABLED", default=True):
            return await call_next(request)
        if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
            return await call_next(request)
        path = request.url.path
        if "/auth/" in path:
            return await call_next(request)
        if path.startswith("/api/"):
            try:
                check_write_rate_limit(request)
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else "Too many requests."
                return JSONResponse(status_code=exc.status_code, content={"error": {"message": detail}})
        return await call_next(request)
