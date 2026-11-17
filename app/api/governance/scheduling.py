"""Scheduling configuration (business hours, blackouts) — governance v1."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, get_current_username, rbac_enforced
from app.core.tenant import get_current_tenant
from app.services.governance_scheduling import get_scheduling_config, upsert_scheduling_config

router = APIRouter(prefix="/governance", tags=["governance"])


def _require(perm: str, role: str) -> None:
    if not rbac_enforced():
        return
    if not role_has_permission(role, perm):
        raise HTTPException(status_code=403, detail=f"Permission denied: {perm}")


def _require_any(role: str, *perms: str) -> None:
    if not rbac_enforced():
        return
    if any(role_has_permission(role, p) for p in perms):
        return
    raise HTTPException(status_code=403, detail=f"Permission denied: one of {', '.join(perms)}")


class WeekdaySlot(BaseModel):
    open: str = Field(min_length=4, max_length=5)
    close: str = Field(min_length=4, max_length=5)


class BlackoutWindowIn(BaseModel):
    start: str = Field(min_length=1, max_length=64)
    end: str = Field(min_length=1, max_length=64)
    reason: str = Field(default="", max_length=512)


class SchedulingConfigIn(BaseModel):
    timezone: str = Field(min_length=1, max_length=64)
    weekday_hours: Dict[str, WeekdaySlot] = Field(default_factory=dict)
    blackout_dates: list[str] = Field(default_factory=list)
    blackout_windows: list[BlackoutWindowIn] = Field(default_factory=list)
    facility_id: Optional[str] = Field(default=None, max_length=128)


@router.get("/scheduling-config")
def scheduling_config_get(
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    facility_id: Optional[str] = Query(None, max_length=128),
) -> Dict[str, Any]:
    _require_any(role, "reservations:read", "platform:read")
    return get_scheduling_config(tenant_id, facility_id=facility_id)


@router.put("/scheduling-config")
def scheduling_config_put(
    body: SchedulingConfigIn,
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    username: str = Depends(get_current_username),
    facility_id: Optional[str] = Query(None, max_length=128),
) -> Dict[str, Any]:
    _require("platform:manage", role)
    scope_facility = body.facility_id if body.facility_id is not None else facility_id
    try:
        hours = {k: v.model_dump() for k, v in body.weekday_hours.items()}
        windows = [w.model_dump() for w in body.blackout_windows]
        return upsert_scheduling_config(
            tenant_id,
            timezone=body.timezone,
            weekday_hours=hours,
            blackout_dates=body.blackout_dates,
            blackout_windows=windows,
            facility_id=scope_facility,
            actor=username,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e