from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.core.tenant import get_current_tenant
from app.services.reproducibility import simulation_budget_check
from app.studio.platform_config import get_studio_platform_config
from app.api.development._auth import require_dev_permission
from app.models.development import CircuitVersionModel, SimulationJobModel
from app.schemas.development import SimulateRequest, SimulationJobOut
from app.services import development_service as dev_svc

router = APIRouter(prefix="/simulation-jobs", tags=["simulation"])


@router.post("/project/{project_id}/simulate", response_model=SimulationJobOut, status_code=201)
def simulate_project(
    project_id: str,
    body: SimulateRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "simulation:run")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    caps = p.capabilities_json or {}
    if caps.get("simulation_cpu") is False:
        raise HTTPException(status_code=403, detail="Simulation disabled for this project")

    if body.circuit_id:
        circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == body.circuit_id).first()
    else:
        circuit = (
            db.query(CircuitVersionModel)
            .filter(CircuitVersionModel.project_id == project_id, CircuitVersionModel.is_head.is_(True))
            .first()
        )
    if not circuit:
        raise HTTPException(status_code=400, detail="No circuit to simulate")

    platform_max = int(get_studio_platform_config()["simulation"].get("max_shots", 100000))
    budget = simulation_budget_check(p.settings_json or {}, body.shots, platform_max)
    if not budget["allowed"]:
        raise HTTPException(status_code=400, detail={"code": "sim_budget_exceeded", "detail": budget["warnings"]})

    job = dev_svc.run_simulation_job(
        db,
        project=p,
        circuit=circuit,
        created_by=username,
        shots=body.shots,
        seed=body.seed,
        execution_target_id=body.execution_target_id,
        parameters=body.parameters,
    )
    return _job_out(job)


@router.get("/{job_id}", response_model=SimulationJobOut)
def get_simulation_job(job_id: str, db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_dev_permission(role, "simulation:read")
    job = db.query(SimulationJobModel).filter(SimulationJobModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_out(job)


@router.get("/{job_id}/result")
def get_simulation_result(job_id: str, db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_dev_permission(role, "simulation:read")
    job = db.query(SimulationJobModel).filter(SimulationJobModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "status": job.status,
        "execution_class": (job.manifest_json or {}).get("execution_class", "simulated"),
        "result": job.result_json,
        "error_message": job.error_message,
    }


@router.get("/{job_id}/manifest")
def get_simulation_manifest(job_id: str, db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_dev_permission(role, "simulation:read")
    job = db.query(SimulationJobModel).filter(SimulationJobModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "manifest": job.manifest_json or {}}


def _job_out(job: SimulationJobModel) -> SimulationJobOut:
    return SimulationJobOut(
        job_id=job.job_id,
        project_id=job.project_id,
        circuit_id=job.circuit_id,
        workload_id=job.workload_id,
        execution_target_id=job.execution_target_id,
        status=job.status,
        shots=job.shots,
        seed=job.seed,
        result=job.result_json,
        manifest=job.manifest_json,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )
