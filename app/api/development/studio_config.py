from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, rbac_enforced
from app.core.tenant import get_current_tenant
from app.models.development import DevProjectModel, SimulationJobModel, WorkloadSubmissionModel
from app.services.approval_fsm import REVIEW_STATES
from app.services.tenant_quota import tenant_sim_shot_quota
from app.studio.platform_config import get_studio_platform_config

router = APIRouter(prefix="/studio", tags=["studio"])


@router.get("/config")
def studio_platform_config(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    """Full customization catalog: features, editor, simulation, templates, open settings schema."""
    require_dev_permission(role, "studio:read")
    return get_studio_platform_config()


@router.get("/features")
def studio_features(role: str = Depends(get_current_role)):
    require_dev_permission(role, "studio:read")
    cfg = get_studio_platform_config()
    return {"features": cfg["features"], "schema_version": cfg["schema_version"]}


@router.get("/summary")
def studio_home_summary(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """Build home KPI strip — avoids N+1 client calls and hides approval counts when RBAC denies."""
    require_dev_permission(role, "studio:read")
    project_count = (
        db.query(DevProjectModel)
        .filter(DevProjectModel.tenant_id == tenant_id, DevProjectModel.is_archived.is_(False))
        .count()
    )
    sim_running = (
        db.query(SimulationJobModel)
        .join(DevProjectModel, DevProjectModel.project_id == SimulationJobModel.project_id)
        .filter(DevProjectModel.tenant_id == tenant_id, SimulationJobModel.status.in_(("queued", "running")))
        .count()
    )
    pending_approvals: Optional[int] = None
    if not rbac_enforced() or role_has_permission(role, "approvals:read"):
        pending_approvals = (
            db.query(WorkloadSubmissionModel)
            .filter(
                WorkloadSubmissionModel.tenant_id == tenant_id,
                WorkloadSubmissionModel.governance_state.in_(tuple(REVIEW_STATES | {"pending_review"})),
            )
            .count()
        )
    quota = tenant_sim_shot_quota(db, tenant_id)

    recent: List[Dict[str, Any]] = []
    sim_rows = (
        db.query(SimulationJobModel, DevProjectModel.name)
        .join(DevProjectModel, DevProjectModel.project_id == SimulationJobModel.project_id)
        .filter(DevProjectModel.tenant_id == tenant_id)
        .order_by(SimulationJobModel.created_at.desc())
        .limit(6)
        .all()
    )
    for job, project_name in sim_rows:
        recent.append(
            {
                "kind": "simulation",
                "id": job.job_id,
                "project_id": job.project_id,
                "project_name": project_name,
                "status": job.status,
                "shots": job.shots,
                "created_at": job.created_at,
            }
        )
    sub_rows = (
        db.query(WorkloadSubmissionModel, DevProjectModel.name)
        .join(DevProjectModel, DevProjectModel.project_id == WorkloadSubmissionModel.project_id)
        .filter(WorkloadSubmissionModel.tenant_id == tenant_id)
        .order_by(WorkloadSubmissionModel.created_at.desc())
        .limit(6)
        .all()
    )
    for sub, project_name in sub_rows:
        recent.append(
            {
                "kind": "submission",
                "id": sub.submission_id,
                "workload_id": sub.workload_id,
                "project_id": sub.project_id,
                "project_name": project_name,
                "status": sub.governance_state,
                "created_at": sub.created_at,
            }
        )
    recent.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    recent = recent[:10]

    return {
        "tenant_id": tenant_id,
        "project_count": project_count,
        "sim_jobs_active": sim_running,
        "pending_approvals": pending_approvals,
        "quota": quota,
        "recent_activity": recent,
    }


@router.get("/quota-evaluate")
def studio_quota_evaluate(
    shots: int = Query(1024, ge=1, le=100_000),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """Shot budget check for Build submit/sim — uses studio:read (not approvals:read)."""
    require_dev_permission(role, "studio:read")
    base = tenant_sim_shot_quota(db, tenant_id)
    remaining = base["remaining_shots"]
    allowed = shots <= remaining
    warnings: List[str] = []
    if not allowed:
        warnings.append(f"Requested {shots} shots exceeds remaining {remaining}")
    elif remaining > 0 and shots > remaining * (base.get("warn_threshold_pct", 80) / 100.0):
        warnings.append(
            f"Requested {shots} shots uses over {base.get('warn_threshold_pct', 80)}% of remaining tenant budget ({remaining})"
        )
    return {
        **base,
        "tenant_id": tenant_id,
        "requested_shots": shots,
        "allowed": allowed,
        "warnings": warnings,
    }
