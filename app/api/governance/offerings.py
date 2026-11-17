"""Resource offering catalog — read-only draft listings from inventory (synthetic v1)."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, rbac_enforced
from app.core.tenant import get_current_tenant
from app.services.governance_offerings import get_draft_offering, list_draft_offerings

router = APIRouter(prefix="/governance", tags=["governance"])


def _require_any(role: str, *perms: str) -> None:
    if not rbac_enforced():
        return
    if any(role_has_permission(role, p) for p in perms):
        return
    raise HTTPException(status_code=403, detail=f"Permission denied: one of {', '.join(perms)}")


@router.get("/offerings")
def offerings_list(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require_any(role, "inventory:read", "platform:read", "approvals:read")
    return list_draft_offerings(db, tenant_id)


@router.get("/offerings/{offering_id}")
def offerings_detail(
    offering_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require_any(role, "inventory:read", "platform:read", "approvals:read")
    row = get_draft_offering(db, tenant_id, offering_id)
    if not row:
        raise HTTPException(status_code=404, detail="Offering not found")
    return row