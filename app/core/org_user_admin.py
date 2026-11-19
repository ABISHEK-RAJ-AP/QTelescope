"""Org-scoped user directory rules for platform vs organisation administrators."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from app.core.permissions import ADMIN_ROLES, role_has

# Fleet-wide user administration (all organisations).
PLATFORM_USER_ADMIN_ROLES = frozenset(ADMIN_ROLES | {"SecurityAdmin"})

ORG_ADMIN_ROLE = "OrgAdmin"

# Roles an organisation admin may assign or invite (no platform-wide privileges).
ORG_ASSIGNABLE_ROLES = frozenset({
    "Viewer",
    "ResearchAnalyst",
    "Researcher",
    "OpsEngineer",
    "Operator",
    "IncidentCommander",
})

PLATFORM_PRIVILEGED_ROLES = frozenset({
    "Admin",
    "SuperAdmin",
    "PlatformAdmin",
    "SecurityAdmin",
    "QuantumOpsAdmin",
    ORG_ADMIN_ROLE,
})


def org_key(org: Optional[str]) -> str:
    return (org or "").strip().casefold()


def actor_record(actor_username: str, users: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    return dict(users.get(actor_username) or {})


def actor_org_key(actor_username: str, users: Dict[str, Dict[str, Any]]) -> str:
    return org_key(actor_record(actor_username, users).get("org"))


def is_platform_user_admin(role: str) -> bool:
    return (role or "") in PLATFORM_USER_ADMIN_ROLES


def is_org_admin(role: str) -> bool:
    return (role or "") == ORG_ADMIN_ROLE


def can_list_users(role: str) -> bool:
    if not role_has(role, "users:read"):
        return False
    return is_platform_user_admin(role) or is_org_admin(role)


def filter_users_for_actor(
    users: Dict[str, Dict[str, Any]],
    *,
    actor_username: str,
    actor_role: str,
) -> List[tuple[str, Dict[str, Any]]]:
    items = sorted(users.items())
    if is_platform_user_admin(actor_role):
        return items
    if is_org_admin(actor_role):
        mine = actor_org_key(actor_username, users)
        if not mine:
            return []
        return [(u, rec) for u, rec in items if org_key(rec.get("org")) == mine]
    return []


def assert_can_view_user(
    *,
    actor_username: str,
    actor_role: str,
    target_username: str,
    users: Dict[str, Dict[str, Any]],
) -> None:
    if not can_list_users(actor_role):
        raise HTTPException(status_code=403, detail="Missing users:read for user directory.")
    if is_platform_user_admin(actor_role):
        return
    if is_org_admin(actor_role):
        rec = users.get(target_username)
        if not rec:
            raise HTTPException(status_code=404, detail="User not found.")
        if org_key(rec.get("org")) != actor_org_key(actor_username, users):
            raise HTTPException(status_code=403, detail="You can only manage users in your organisation.")
        return
    raise HTTPException(status_code=403, detail="Not allowed to access this user.")


def assert_role_assignable_by_actor(actor_role: str, new_role: str) -> None:
    if is_org_admin(actor_role) and new_role not in ORG_ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=403,
            detail=f"Organisation admins cannot assign the {new_role} role.",
        )
    if is_org_admin(actor_role) and new_role == ORG_ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Promote organisation administrators via a platform admin.")


def assert_can_change_account_status(actor_role: str, target_rec: Dict[str, Any]) -> None:
    target_role = (target_rec.get("role") or "").strip()
    if is_org_admin(actor_role) and target_role in PLATFORM_PRIVILEGED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Organisation admins cannot change platform or organisation administrator accounts.",
        )


def resolve_invite_org(
    *,
    actor_username: str,
    actor_role: str,
    requested_org: str,
    users: Dict[str, Dict[str, Any]],
) -> str:
    org = (requested_org or "").strip()
    if is_org_admin(actor_role):
        mine = actor_record(actor_username, users).get("org") or ""
        if not (mine or "").strip():
            raise HTTPException(status_code=403, detail="Your account has no organisation; contact a platform administrator.")
        if org and org_key(org) != org_key(mine):
            raise HTTPException(status_code=403, detail="Invitations must use your organisation name.")
        return mine.strip()
    if not org:
        raise HTTPException(status_code=400, detail="Organisation is required for invitations.")
    return org