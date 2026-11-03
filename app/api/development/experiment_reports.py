from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.core.tenant import get_current_tenant
from app.models.development import DevExperimentReportModel
from app.schemas.development import ExperimentReportCreate, ExperimentReportOut
from app.services import development_service as dev_svc
from app.services.experiment_report_service import generate_experiment_report

router = APIRouter(tags=["experiment-reports"])


@router.post("/projects/{project_id}/experiment-reports", response_model=ExperimentReportOut, status_code=201)
def create_experiment_report(
    project_id: str,
    body: ExperimentReportCreate,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "reports:export")
    project = dev_svc.get_project(db, project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    report = generate_experiment_report(
        db,
        project=project,
        tenant_id=tenant_id,
        created_by=username,
        title=body.title,
        simulation_job_id=body.simulation_job_id,
    )
    return ExperimentReportOut(
        report_id=report.report_id,
        project_id=report.project_id,
        tenant_id=report.tenant_id,
        title=report.title,
        format=report.format,
        manifest=report.manifest_json or {},
        download_path=f"/api/v1/experiment-reports/{report.report_id}/download",
        created_by=report.created_by,
        created_at=report.created_at,
    )


@router.get("/experiment-reports/{report_id}", response_model=ExperimentReportOut)
def get_experiment_report(
    report_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "reports:read")
    r = (
        db.query(DevExperimentReportModel)
        .filter(DevExperimentReportModel.report_id == report_id, DevExperimentReportModel.tenant_id == tenant_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return ExperimentReportOut(
        report_id=r.report_id,
        project_id=r.project_id,
        tenant_id=r.tenant_id,
        title=r.title,
        format=r.format,
        manifest=r.manifest_json or {},
        download_path=f"/api/v1/experiment-reports/{report_id}/download",
        created_by=r.created_by,
        created_at=r.created_at,
    )


@router.get("/experiment-reports/{report_id}/download", response_class=HTMLResponse)
def download_experiment_report(
    report_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "reports:read")
    r = (
        db.query(DevExperimentReportModel)
        .filter(DevExperimentReportModel.report_id == report_id, DevExperimentReportModel.tenant_id == tenant_id)
        .first()
    )
    if not r or not r.content_html:
        raise HTTPException(status_code=404, detail="Report not found")
    return HTMLResponse(content=r.content_html)
