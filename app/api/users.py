"""User profile, preferences, and admin directory."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.permissions import list_assignable_roles, permissions_for_role
from app.core.rbac import get_current_role, get_current_username, require_admin, require_permission
from app.core.user_prefs import get_preferences, set_preferences
from app.core.user_store import load_all_users, upsert_user
from app.core.user_mfa import (
    confirm_enroll,
    disable_mfa,
    mfa_status,
    start_enroll,
)
from app.core.audit_log import record_audit

router = APIRouter(prefix="/users", tags=["Users"])


def _bearer_token(authorization: Optional[str] = Header(None, alias="Authorization")) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


class ProfilePatch(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    org: Optional[str] = None
    designation: Optional[str] = None


class PreferencesPatch(BaseModel):
    theme: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    display_density: Optional[str] = None
    default_alerts_view: Optional[str] = None
    notify_critical: Optional[bool] = None
    notify_warning: Optional[bool] = None
    notify_incidents: Optional[bool] = None
    notify_comments: Optional[bool] = None
    landing_page: Optional[str] = None


class RolePatch(BaseModel):
    role: str = Field(..., min_length=2, max_length=40)


class TotpConfirmBody(BaseModel):
    code: str


class TotpDisableBody(BaseModel):
    code: str


def _profile(username: str) -> Dict[str, Any]:
    users = load_all_users()
    rec = users.get(username) or {}
    prefs = get_preferences(username)
    role = rec.get("role") or "Operator"
    return {
        "username": username,
        "email": rec.get("email") or "",
        "full_name": rec.get("full_name") or username,
        "org": rec.get("org") or "",
        "designation": prefs.get("designation") or "",
        "role": role,
        "role_label": role,
        "permissions": sorted(permissions_for_role(role)),
        "created_at": rec.get("created_at"),
        "mfa": mfa_status(username),
    }


@router.get("/me")
def get_me_profile(username: str = Depends(get_current_username)):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    return _profile(username)


@router.patch("/me")
def patch_me_profile(
    body: ProfilePatch,
    username: str = Depends(get_current_username),
    role: str = Depends(get_current_role),
):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    users = load_all_users()
    rec = dict(users.get(username) or {"username": username, "password_hash": ""})
    if body.full_name is not None:
        rec["full_name"] = body.full_name.strip()
    if body.email is not None:
        rec["email"] = body.email.strip()
    if body.org is not None:
        rec["org"] = body.org.strip()
    upsert_user(username, rec)
    if body.designation is not None:
        set_preferences(username, {"designation": body.designation.strip()})
    record_audit("profile.update", actor=username, role=role, resource_type="user", resource_id=username)
    return _profile(username)


@router.get("/me/preferences")
def get_me_preferences(username: str = Depends(get_current_username)):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    return get_preferences(username)


@router.patch("/me/preferences")
def patch_me_preferences(body: PreferencesPatch, username: str = Depends(get_current_username)):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    patch = body.model_dump(exclude_none=True)
    return set_preferences(username, patch)


@router.get("/roles/catalog")
def roles_catalog():
    return {"roles": list_assignable_roles()}


@router.get("", response_model=List[dict])
def list_users(_: str = Depends(require_admin)):
    users = load_all_users()
    out = []
    for uname, rec in sorted(users.items()):
        prefs = get_preferences(uname)
        out.append({
            "username": uname,
            "email": rec.get("email"),
            "full_name": rec.get("full_name"),
            "org": rec.get("org"),
            "role": rec.get("role") or "Operator",
            "mfa_enabled": mfa_status(uname).get("enabled"),
            "designation": prefs.get("designation"),
            "created_at": rec.get("created_at"),
        })
    return out


@router.patch("/{target_username}/role")
def assign_role(
    target_username: str,
    body: RolePatch,
    actor: str = Depends(get_current_username),
    role: str = Depends(require_admin),
):
    from app.core.permissions import ROLE_PERMISSIONS

    new_role = body.role.strip()
    if new_role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {new_role}")
    if target_username == actor and new_role not in ("Admin", "PlatformAdmin"):
        raise HTTPException(status_code=400, detail="Cannot demote your own admin access here.")
    users = load_all_users()
    if target_username not in users:
        raise HTTPException(status_code=404, detail="User not found.")
    rec = dict(users[target_username])
    old = rec.get("role")
    rec["role"] = new_role
    upsert_user(target_username, rec)
    record_audit(
        "user.role_change",
        actor=actor,
        role=role,
        resource_type="user",
        resource_id=target_username,
        detail={"from": old, "to": new_role},
    )
    return {"username": target_username, "role": new_role}


@router.get("/me/mfa/status")
def totp_status(username: str = Depends(get_current_username)):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    return mfa_status(username)


@router.post("/me/mfa/enroll/start")
def totp_enroll_start(username: str = Depends(get_current_username)):
    secret, otpauth, _ = start_enroll(username)
    return {"secret": secret, "otpauth_url": otpauth}


@router.post("/me/mfa/enroll/confirm")
def totp_enroll_confirm(body: TotpConfirmBody, username: str = Depends(get_current_username)):
    ok, backups = confirm_enroll(username, body.code)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    record_audit("mfa.enroll", actor=username, resource_type="user", resource_id=username)
    return {"enabled": True, "backup_codes": backups}


@router.post("/me/mfa/disable")
def totp_disable(body: TotpDisableBody, username: str = Depends(get_current_username)):
    if not disable_mfa(username, body.code):
        raise HTTPException(status_code=400, detail="Invalid code.")
    record_audit("mfa.disable", actor=username, resource_type="user", resource_id=username)
    return {"enabled": False}


@router.get("/me/sessions")
def list_my_sessions(
    username: str = Depends(get_current_username),
    token: Optional[str] = Depends(_bearer_token),
):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    from app.core.sessions import list_user_sessions

    rows = list_user_sessions(username, current_token=token)
    return {"sessions": rows}


@router.post("/me/sessions/revoke-others")
def revoke_other_sessions(
    username: str = Depends(get_current_username),
    token: Optional[str] = Depends(_bearer_token),
):
    if username == "anonymous" or not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    from app.core.sessions import revoke_other_sessions

    n = revoke_other_sessions(username, token)
    record_audit("sessions.revoke_others", actor=username, resource_type="user", resource_id=username, detail={"count": n})
    return {"revoked": n}


@router.delete("/me/sessions/{session_id}")
def revoke_one_session(
    session_id: str,
    username: str = Depends(get_current_username),
    token: Optional[str] = Depends(_bearer_token),
):
    if username == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    from app.core.sessions import revoke_session_for_user

    if not revoke_session_for_user(username, session_id, current_token=token):
        raise HTTPException(status_code=400, detail="Session not found or cannot revoke current session.")
    record_audit(
        "sessions.revoke",
        actor=username,
        resource_type="session",
        resource_id=session_id,
    )
    return {"revoked": True}
