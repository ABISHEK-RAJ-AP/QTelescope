from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.models.development import CircuitVersionModel, PreflightReportModel
from app.schemas.development import PreflightReportOut, PreflightRequest
from app.services.preflight_service import run_preflight

router = APIRouter(tags=["preflight"])


def _report_out(r: PreflightReportModel) -> PreflightReportOut:
    return PreflightReportOut(
        report_id=r.report_id,
        project_id=r.project_id,
        circuit_id=r.circuit_id,
        execution_target_id=r.execution_target_id,
        status=r.status,
        execution_class=r.execution_class,
        violations=r.violations_json or [],
        metrics=r.metrics_json or {},
        created_by=r.created_by,
        created_at=r.created_at,
        completed_at=r.completed_at,
    )


@router.post("/circuits/{circuit_id}/preflight", response_model=PreflightReportOut, status_code=201)
def preflight_circuit(
    circuit_id: str,
    body: PreflightRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
):
    require_dev_permission(role, "preflight:run")
    circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == circuit_id).first()
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    report = run_preflight(
        db,
        project_id=circuit.project_id,
        circuit_id=circuit.circuit_id,
        source_text=circuit.source_text or "",
        source_language=circuit.source_language,
        execution_target_id=body.execution_target_id,
        created_by=username,
        options=body.model_dump(exclude_unset=True),
    )
    return _report_out(report)


@router.get("/preflight-reports/{report_id}", response_model=PreflightReportOut)
def get_preflight_report(
    report_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_dev_permission(role, "preflight:read")
    r = db.query(PreflightReportModel).filter(PreflightReportModel.report_id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Preflight report not found")
    return _report_out(r)
