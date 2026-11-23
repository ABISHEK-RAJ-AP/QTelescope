"""Shared validation for self-service registration."""
from __future__ import annotations

from typing import Any, Dict, Tuple

from fastapi import HTTPException

from app.core.config import settings
from app.core.identity import bound_password, normalize_email, normalize_username
from app.core.self_registration import resolve_self_registration_role
from app.core import user_store


def assert_org_open_for_self_registration(org: str) -> None:
    """Block when an organisation name already exists in the user directory."""
    from app.core.registration_policy import registered_organisation_names

    name = (org or "").strip()
    if not name:
        return
    key = name.casefold()
    if any(existing.casefold() == key for existing in registered_organisation_names()):
        raise HTTPException(
            status_code=409,
            detail=(
                f'"{name}" already has console accounts. '
                "Contact that organisation's administrator for an invitation instead of registering again."
            ),
        )


def validate_new_account_fields(
    *,
    username: str,
    email: str,
    password: str,
    role: str | None,
) -> Tuple[str, str, str]:
    u = normalize_username(username)
    e = normalize_email(email)
    bound_password(password)
    if u in (settings.ADMIN_USERNAME, settings.USER_USERNAME, settings.SUPERADMIN_USERNAME):
        raise HTTPException(status_code=409, detail="That username is reserved.")
    requested_role = (role or "").strip()
    if requested_role in ("Admin", "SuperAdmin", "PlatformAdmin", "SecurityAdmin", "QuantumOpsAdmin", "OrgAdmin"):
        raise HTTPException(
            status_code=403,
            detail="Administrator accounts cannot be self-registered. Ask your organisation admin to invite you.",
        )
    resolved = resolve_self_registration_role(role)
    users = user_store.load_all_users()
    if u in users:
        raise HTTPException(status_code=409, detail="Username already registered.")
    if any((rec.get("email") or "").strip().lower() == e for rec in users.values()):
        raise HTTPException(status_code=409, detail="Email already registered.")
    return u, e, resolved


def account_status_login_message(status: str | None) -> str | None:
    s = (status or "active").strip().lower()
    if s == "active":
        return None
    if s == "pending_admin":
        return "Your registration is awaiting administrator approval. You will be able to sign in after approval."
    if s == "rejected":
        return "Your registration request was not approved. Contact your platform administrator."
    if s == "suspended":
        return "This account is suspended. Contact your platform administrator."
    return "This account cannot sign in yet. Contact your platform administrator."


def registration_user_record(
    *,
    username: str,
    email: str,
    full_name: str,
    org: str,
    role: str,
    password_hash: str,
    account_status: str,
) -> Dict[str, Any]:
    import time

    return {
        "username": username,
        "email": email,
        "full_name": full_name,
        "org": org,
        "role": role,
        "password_hash": password_hash,
        "account_status": account_status,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }