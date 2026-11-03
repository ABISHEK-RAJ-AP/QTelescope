"""Quota evaluation and operational shot ledger."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, rbac_enforced
from app.core.tenant import get_current_tenant
from app.models.development import DevProjectModel, SimulationJobModel
from app.services.quota_policy import load_quota_policy
from app.services.tenant_quota import (
    WINDOWS,
    evaluate_workload_quota,
    in_window,
    job_event_time,
    tenant_sim_shot_quota,
    window_bounds,
)

router = APIRouter(prefix="/quotas", tags=["governance"])


def _require_quota_read(role: str) -> None:
    if not rbac_enforced():
        return
    if role_has_permission(role, "quotas:read") or role_has_permission(role, "reports:read"):
        return
    raise HTTPException(status_code=403, detail="Permission denied: quotas:read")


@router.get("/evaluate")
def evaluate_quota(
    workload_id: Optional[str] = Query(None),
    shots: Optional[int] = Query(None),
    project_id: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require_quota_read(role)
    try:
        return evaluate_workload_quota(
            db,
            tenant_id,
            workload_id=workload_id,
            shots=shots,
            project_id=project_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Workload not found") from exc


@router.get("/ledger")
def quota_ledger(
    limit: int = Query(50, ge=1, le=200),
    project_id: Optional[str] = Query(None, max_length=128),
    window: str = Query("today", max_length=16),
    include_incomplete: bool = Query(False),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """Operational ledger: policy + windowed usage + contributing jobs. Shot dimension only."""
    _require_quota_read(role)
    if window not in WINDOWS:
        raise HTTPException(status_code=400, detail=f"window must be one of: {', '.join(WINDOWS)}")
    base = tenant_sim_shot_quota(db, tenant_id, project_id=project_id, window=window)
    policy = load_quota_policy()
    start, end, resolved = window_bounds(window)
    q = (
        db.query(SimulationJobModel, DevProjectModel.name)
        .join(DevProjectModel, DevProjectModel.project_id == SimulationJobModel.project_id)
        .filter(DevProjectModel.tenant_id == tenant_id)
    )
    if project_id:
        q = q.filter(SimulationJobModel.project_id == project_id)
    if not include_incomplete:
        q = q.filter(SimulationJobModel.status == "completed")
    rows = q.order_by(SimulationJobModel.created_at.desc()).all()
    windowed: List[Any] = []
    for job, project_name in rows:
        when = job_event_time(job)
        if not in_window(when, start, end):
            continue
        windowed.append((job, project_name))
    by_project: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"project_id": "", "project_name": "", "shots": 0, "jobs": 0}
    )
    for job, project_name in windowed:
        if job.status != "completed":
            continue
        bucket = by_project[job.project_id]
        bucket["project_id"] = job.project_id
        bucket["project_name"] = project_name
        bucket["shots"] += job.shots or 0
        bucket["jobs"] += 1
    entries = [
        {
            "job_id": job.job_id,
            "project_id": job.project_id,
            "project_name": project_name,
            "workload_id": job.workload_id,
            "circuit_id": job.circuit_id,
            "shots": job.shots or 0,
            "status": job.status,
            "created_by": job.created_by,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "counts_toward_quota": job.status == "completed",
        }
        for job, project_name in windowed[:limit]
    ]
    return {
        **base,
        "tenant_id": tenant_id,
        "policy_source": str(policy.get("policy_id", "default_tenant_shots")),
        "ledger_kind": "simulation_shots_daily",
        "dimension": "simulation_shots",
        "dimension_note": "Only completed simulation shots consume the daily cap. Other quota dimensions are not configured.",
        "include_incomplete": include_incomplete,
        "window": resolved,
        "limit": limit,
        "entry_count": len(windowed),
        "by_project": sorted(by_project.values(), key=lambda row: row["shots"], reverse=True),
        "entries": entries,
    }
