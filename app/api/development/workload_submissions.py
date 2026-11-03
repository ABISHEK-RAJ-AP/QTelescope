from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.core.tenant import get_current_tenant
from app.models.development import CircuitVersionModel, WorkloadSubmissionModel
from app.schemas.development import WorkloadSubmissionCreate, WorkloadSubmissionOut
from app.services import development_service as dev_svc
from app.services.approval_fsm import governance_progress
from app.services.submission_service import create_submission, submit_for_review

router = APIRouter(prefix="/workload-submissions", tags=["workload-submissions"])


def _sub_out(s: WorkloadSubmissionModel) -> WorkloadSubmissionOut:
    return WorkloadSubmissionOut(
        submission_id=s.submission_id,
        workload_id=s.workload_id,
        tenant_id=s.tenant_id,
        project_id=s.project_id,
        circuit_id=s.circuit_id,
        compilation_run_id=s.compilation_run_id,
        preflight_report_id=s.preflight_report_id,
        package_sha256=s.package_sha256,
        manifest=s.manifest_json or {},
        governance_state=s.governance_state,
        governance_progress=governance_progress(s),
        created_by=s.created_by,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.post("", response_model=WorkloadSubmissionOut, status_code=201)
def create_workload_submission(
    body: WorkloadSubmissionCreate,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "submissions:create")
    project = dev_svc.get_project(db, body.project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    circuit = None
    if body.circuit_id:
        circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == body.circuit_id).first()
    else:
        circuit = (
            db.query(CircuitVersionModel)
            .filter(CircuitVersionModel.project_id == body.project_id, CircuitVersionModel.is_head.is_(True))
            .first()
        )
    sub = create_submission(
        db,
        tenant_id=tenant_id,
        project=project,
        circuit=circuit,
        compilation_run_id=body.compilation_run_id,
        preflight_report_id=body.preflight_report_id,
        created_by=username,
        metadata=body.metadata,
    )
    return _sub_out(sub)


@router.get("")
def list_submissions(
    project_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "submissions:read")
    rows = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.project_id == project_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
        )
        .order_by(WorkloadSubmissionModel.created_at.desc())
        .limit(50)
        .all()
    )
    return {"submissions": [_sub_out(s) for s in rows]}


@router.get("/{submission_id}", response_model=WorkloadSubmissionOut)
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "submissions:read")
    s = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.submission_id == submission_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
        )
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")
    return _sub_out(s)


@router.post("/{submission_id}/submit-for-review", response_model=WorkloadSubmissionOut)
def submit_submission_for_review(
    submission_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "submissions:submit")
    s = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.submission_id == submission_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
        )
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")
    try:
        updated = submit_for_review(db, s)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _sub_out(updated)
