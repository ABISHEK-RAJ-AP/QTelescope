"""Public signup: first account for a new organisation becomes OrgAdmin; staff join via invite."""
from __future__ import annotations

from fastapi import HTTPException

from app.core.org_user_admin import ORG_ADMIN_ROLE

# Self-service cannot create platform-wide roles (bootstrap / platform invite only).
_PLATFORM_SELF_REGISTER_FORBIDDEN = frozenset({
    "Admin",
    "SuperAdmin",
    "PlatformAdmin",
    "SecurityAdmin",
    "QuantumOpsAdmin",
})

SELF_REGISTER_ORG_OWNER_ROLE = ORG_ADMIN_ROLE


def reject_client_requested_privileged_role(requested: str | None) -> None:
    r = (requested or "").strip()
    if not r:
        return
    if r in _PLATFORM_SELF_REGISTER_FORBIDDEN:
        raise HTTPException(
            status_code=403,
            detail="Platform administrator accounts cannot be self-registered. Use deployment credentials or contact the site operator.",
        )
    # Operator/Researcher/etc. in the request body are ignored — server assigns OrgAdmin for new orgs.


def resolve_org_owner_registration_role(*, org: str) -> str:
    """New organisation → OrgAdmin (ignored client role). Existing org must be blocked earlier."""
    from app.core.registration_policy import org_has_console_accounts

    if org_has_console_accounts(org):
        raise HTTPException(
            status_code=409,
            detail=(
                f'"{org.strip()}" already has console accounts. '
                "Contact that organisation's administrator for an invitation."
            ),
        )
    return SELF_REGISTER_ORG_OWNER_ROLE