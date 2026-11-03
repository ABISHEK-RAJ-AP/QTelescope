"""Resource reservation lifecycle (OD-QRP-02 — operational UI with file-backed store)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, get_current_username, rbac_enforced
from app.core.tenant import get_current_tenant
from app.services.governance_reservations import (
    RESERVATION_STATES,
    TRANSITIONS,
    create_reservation,
    list_reservations,
    transition_reservation,
)

router = APIRouter(prefix="/reservations", tags=["governance"])


def _require(perm: str, role: str) -> None:
    if not rbac_enforced():
        return
    if not role_has_permission(role, perm):
        raise HTTPException(status_code=403, detail=f"Permission denied: {perm}")


class ReservationIn(BaseModel):
    resource_ref: str = Field(min_length=1, max_length=256)
    project_id: Optional[str] = Field(default=None, max_length=128)
    window_start: str = Field(min_length=1, max_length=64)
    window_end: str = Field(min_length=1, max_length=64)
    purpose: str = Field(min_length=1, max_length=512)


class ReservationTransitionIn(BaseModel):
    state: str = Field(min_length=1, max_length=32)


@router.get("")
def reservations_list(
    state: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None, max_length=128),
    resource_ref: Optional[str] = Query(None, max_length=256),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require("reservations:read", role)
    if state and state not in RESERVATION_STATES:
        raise HTTPException(status_code=400, detail=f"state must be one of: {', '.join(RESERVATION_STATES)}")
    items = list_reservations(tenant_id, state=state, project_id=project_id, resource_ref=resource_ref)
    return {
        "items": items,
        "states": list(RESERVATION_STATES),
        "transitions": {src: sorted(dst) for src, dst in TRANSITIONS.items()},
        "conflict_count": sum(1 for row in items if row.get("has_conflict")),
    }


@router.post("")
def reservations_create(
    body: ReservationIn,
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    username: str = Depends(get_current_username),
) -> Dict[str, Any]:
    _require("reservations:manage", role)
    try:
        return create_reservation(
            tenant_id,
            resource_ref=body.resource_ref,
            project_id=body.project_id,
            window_start=body.window_start,
            window_end=body.window_end,
            purpose=body.purpose,
            actor=username,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{reservation_id}/transition")
def reservations_transition(
    reservation_id: str,
    body: ReservationTransitionIn,
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    username: str = Depends(get_current_username),
) -> Dict[str, Any]:
    _require("reservations:manage", role)
    try:
        return transition_reservation(tenant_id, reservation_id, state=body.state, actor=username)
    except KeyError:
        raise HTTPException(status_code=404, detail="Reservation not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
