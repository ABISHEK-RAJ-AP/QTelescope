"""Circuit-scoped simulation routes (OpenAPI-neutral paths)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.api.development.simulation import _job_out
from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.core.tenant import get_current_tenant
from app.models.development import CircuitVersionModel, SimulationJobModel
from app.schemas.development import SimulateRequest, SimulationJobOut
from app.services import development_service as dev_svc
from app.services.reproducibility import simulation_budget_check
from app.studio.platform_config import get_studio_platform_config

router = APIRouter(tags=["simulation"])


def _simulate_circuit(
    db: Session,
    circuit: CircuitVersionModel,
    body: SimulateRequest,
    username: str,
    tenant_id: str,
) -> SimulationJobModel:
    p = dev_svc.get_project(db, circuit.project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    caps = p.capabilities_json or {}
    if caps.get("simulation_cpu") is False:
        raise HTTPException(status_code=403, detail="Simulation disabled for this project")
    platform_max = int(get_studio_platform_config()["simulation"].get("max_shots", 100000))
    budget = simulation_budget_check(p.settings_json or {}, body.shots, platform_max)
    if not budget["allowed"]:
        raise HTTPException(status_code=400, detail={"code": "sim_budget_exceeded", "detail": budget["warnings"]})
    return dev_svc.run_simulation_job(
        db,
        project=p,
        circuit=circuit,
        created_by=username,
        shots=body.shots,
        seed=body.seed,
        execution_target_id=body.execution_target_id,
        parameters=body.parameters,
    )


@router.post("/circuits/{circuit_id}/simulate", response_model=SimulationJobOut, status_code=201)
def simulate_circuit(
    circuit_id: str,
    body: SimulateRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "simulation:run")
    circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == circuit_id).first()
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    job = _simulate_circuit(db, circuit, body, username, tenant_id)
    return _job_out(job)
