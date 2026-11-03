"""Tenant scope from session (never trust body alone)."""
from __future__ import annotations

import os
import re
from typing import Optional

from fastapi import Header, HTTPException, Request

from app.core.rbac import rbac_enforced
from app.core.sessions import get_session


def default_tenant_id() -> str:
    return os.getenv("DEFAULT_TENANT_ID", "default").strip() or "default"


def _slug_tenant(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return s[:64] or default_tenant_id()


def tenant_from_session_record(session: dict) -> str:
    tid = session.get("tenant_id")
    if tid:
        return str(tid)
    org = session.get("org")
    if org:
        return _slug_tenant(str(org))
    return default_tenant_id()


def get_current_tenant(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
) -> str:
    if getattr(request.state, "tenant_id", None):
        return str(request.state.tenant_id)
    auth = authorization or ""
    if auth.lower().startswith("bearer "):
        sess = get_session(auth[7:].strip())
        if sess:
            return tenant_from_session_record(sess)
    if not rbac_enforced() and x_tenant_id:
        return _slug_tenant(x_tenant_id)
    return default_tenant_id()


def require_project_tenant(project_tenant: str, current: str) -> None:
    if project_tenant != current:
        raise HTTPException(status_code=404, detail="Project not found")
