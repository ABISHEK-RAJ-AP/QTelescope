"""Tenant shot quota — daily cap vs completed simulation jobs."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.development import DevProjectModel, SimulationJobModel, WorkloadModel, WorkloadSubmissionModel
from app.services.quota_policy import daily_shots_cap_for_tenant, load_quota_policy, warn_threshold_pct

WINDOWS = ("today", "7d", "30d", "all")


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def job_event_time(job: SimulationJobModel) -> Optional[datetime]:
    return _aware(job.completed_at) or _aware(job.created_at)


def window_bounds(window: str = "today") -> Tuple[Optional[datetime], datetime, str]:
    now = datetime.now(timezone.utc)
    key = (window or "today").strip().lower()
    if key not in WINDOWS:
        key = "today"
    if key == "all":
        return None, now, "all"
    if key == "7d":
        return now - timedelta(days=7), now, "7d"
    if key == "30d":
        return now - timedelta(days=30), now, "30d"
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, now, "today"


def in_window(when: Optional[datetime], start: Optional[datetime], end: datetime) -> bool:
    if when is None:
        return False
    if start is not None and when < start:
        return False
    return when <= end


def _completed_jobs(db: Session, tenant_id: str, project_id: Optional[str] = None) -> List[SimulationJobModel]:
    q = (
        db.query(SimulationJobModel)
        .join(DevProjectModel, DevProjectModel.project_id == SimulationJobModel.project_id)
        .filter(DevProjectModel.tenant_id == tenant_id, SimulationJobModel.status == "completed")
    )
    if project_id:
        q = q.filter(SimulationJobModel.project_id == project_id)
    return q.all()


def _sum_shots(jobs: Iterable[SimulationJobModel]) -> int:
    return sum((job.shots or 0) for job in jobs)


def tenant_sim_shot_quota(
    db: Session,
    tenant_id: str,
    *,
    project_id: Optional[str] = None,
    window: str = "today",
) -> Dict[str, Any]:
    """Daily cap is policy. `used_shots` is completed shots in the requested window (default today UTC)."""
    daily_cap = daily_shots_cap_for_tenant(tenant_id)
    start, end, resolved = window_bounds(window)
    jobs = _completed_jobs(db, tenant_id, project_id)
    used_lifetime = _sum_shots(jobs)
    used_window = _sum_shots(job for job in jobs if in_window(job_event_time(job), start, end))
    remaining = max(0, daily_cap - used_window)
    return {
        "policy_id": load_quota_policy().get("policy_id", "default_tenant_shots"),
        "daily_shots_cap": daily_cap,
        "used_shots": used_window,
        "used_shots_window": used_window,
        "used_shots_lifetime": used_lifetime,
        "remaining_shots": remaining,
        "headroom_pct": round(100.0 * remaining / daily_cap, 1) if daily_cap else 0,
        "warn_threshold_pct": warn_threshold_pct(),
        "window": resolved,
        "window_start": start.isoformat() if start else None,
        "window_end": end.isoformat(),
        "project_id": project_id,
    }


def resolve_workload_project(db: Session, tenant_id: str, workload_id: str) -> Optional[str]:
    sub = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.workload_id == workload_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
        )
        .order_by(WorkloadSubmissionModel.created_at.desc())
        .first()
    )
    if sub and sub.project_id:
        return sub.project_id
    wl = (
        db.query(WorkloadModel)
        .filter(WorkloadModel.workload_id == workload_id, WorkloadModel.tenant_id == tenant_id)
        .first()
    )
    return wl.project_id if wl else None


def infer_shots_for_workload(db: Session, tenant_id: str, workload_id: str) -> Optional[int]:
    """Latest completed sim shots on the submission's project."""
    project_id = resolve_workload_project(db, tenant_id, workload_id)
    if not project_id:
        return None
    job = (
        db.query(SimulationJobModel)
        .join(DevProjectModel, DevProjectModel.project_id == SimulationJobModel.project_id)
        .filter(
            DevProjectModel.tenant_id == tenant_id,
            SimulationJobModel.project_id == project_id,
            SimulationJobModel.status == "completed",
        )
        .order_by(SimulationJobModel.created_at.desc())
        .first()
    )
    if job and job.shots is not None:
        return int(job.shots)
    return None


def evaluate_workload_quota(
    db: Session,
    tenant_id: str,
    *,
    workload_id: Optional[str] = None,
    shots: Optional[int] = None,
    project_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Today-UTC daily cap vs requested shots. Preview GET and authorize-dispatch share this."""
    scoped_project = project_id
    if workload_id:
        found = resolve_workload_project(db, tenant_id, workload_id)
        if found is None and not scoped_project:
            raise KeyError("workload_not_found")
        if not scoped_project:
            scoped_project = found
    base = tenant_sim_shot_quota(db, tenant_id, project_id=scoped_project, window="today")
    shots_inferred = False
    if shots is not None:
        requested = int(shots)
    elif workload_id:
        inferred = infer_shots_for_workload(db, tenant_id, workload_id)
        if inferred is not None:
            requested = inferred
            shots_inferred = True
        else:
            requested = 0
    else:
        requested = 0
    remaining = int(base["remaining_shots"])
    allowed = requested <= remaining if requested else True
    warnings: List[str] = []
    if requested and not allowed:
        warnings.append(f"Requested {requested} exceeds remaining {remaining}")
    return {
        **base,
        "tenant_id": tenant_id,
        "workload_id": workload_id,
        "requested_shots": requested,
        "shots_inferred": shots_inferred,
        "allowed": allowed,
        "warnings": warnings,
        "reason_code": "quota_pass" if allowed else "quota_fail",
    }
