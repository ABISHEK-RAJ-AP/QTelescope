"""RBAC: session role when token present; optional ENFORCE_RBAC."""
from __future__ import annotations

import os
from typing import FrozenSet, Optional

from fastapi import Depends, Header, HTTPException, Request

from app.core.sessions import get_session, require_api_auth

ADMIN_ROLES: FrozenSet[str] = frozenset({"Admin", "SuperAdmin", "PlatformAdmin"})
OPERATOR_ROLES: FrozenSet[str] = frozenset({"Admin", "SuperAdmin", "PlatformAdmin", "Operator", "QuantumOpsAdmin", "OpsEngineer"})
EVIDENCE_READER_ROLES: FrozenSet[str] = frozenset({"Admin", "SuperAdmin", "PlatformAdmin", "Operator", "Researcher", "Auditor"})


def rbac_enforced() -> bool:
    from app.core.env_profile import env_flag_prod_default_true

    return env_flag_prod_default_true("ENFORCE_RBAC")


def _role_from_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:].strip()
    sess = get_session(token)
    return sess.get("role") if sess else None


def get_current_role(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> str:
    if getattr(request.state, "role", None):
        return str(request.state.role)
    from_session = _role_from_bearer(authorization)
    if from_session:
        return from_session
    if require_api_auth():
        raise HTTPException(status_code=401, detail="Valid session token required.")
    return (x_user_role or "Anonymous").strip() or "Anonymous"


def get_current_username(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> str:
    if getattr(request.state, "username", None):
        return str(request.state.username)
    auth = authorization or ""
    if auth.lower().startswith("bearer "):
        sess = get_session(auth[7:].strip())
        if sess:
            return str(sess.get("username") or "unknown")
    # Dev stand-in only. Production identity is the session (see QRP plan §3).
    if x_user_name and x_user_name.strip():
        return x_user_name.strip()
    if x_user_role and x_user_role.strip() and x_user_role.strip() != "Anonymous":
        return x_user_role.strip()
    return "anonymous"


def _check(role: str, allowed: FrozenSet[str]) -> str:
    if not rbac_enforced():
        return role
    if role not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Requires role in {sorted(allowed)} (send X-User-Role from authenticated session).",
        )
    return role


def require_admin(role: str = Depends(get_current_role)) -> str:
    return _check(role, ADMIN_ROLES)


def require_operator(role: str = Depends(get_current_role)) -> str:
    return _check(role, OPERATOR_ROLES)


def require_evidence_reader(role: str = Depends(get_current_role)) -> str:
    return _check(role, EVIDENCE_READER_ROLES)


def require_permission(permission: str):
    """FastAPI dependency: role must include permission when ENFORCE_RBAC."""
    from app.core.permissions import role_has

    def _dep(role: str = Depends(get_current_role)) -> str:
        if not rbac_enforced():
            return role
        if not role_has(role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Missing permission {permission} for role {role}.",
            )
        return role

    return _dep
