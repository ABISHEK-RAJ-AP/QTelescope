from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.models.development import CircuitVersionModel, CompilationRunModel
from app.schemas.development import CompileRequest, CompilationRunOut
from app.services.compilation_service import run_compilation

router = APIRouter(tags=["compilation"])


def _run_out(run: CompilationRunModel) -> CompilationRunOut:
    return CompilationRunOut(
        run_id=run.run_id,
        project_id=run.project_id,
        circuit_id=run.circuit_id,
        status=run.status,
        transpile_config=run.transpile_config_json or {},
        diagnostics=run.diagnostics_json or [],
        compiled_artifact=run.compiled_artifact_json,
        tool=run.tool,
        tool_version=run.tool_version,
        created_by=run.created_by,
        created_at=run.created_at,
        completed_at=run.completed_at,
    )


@router.post("/circuits/{circuit_id}/compile", response_model=CompilationRunOut, status_code=201)
def compile_circuit_route(
    circuit_id: str,
    body: CompileRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
):
    require_dev_permission(role, "compilation:run")
    circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == circuit_id).first()
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    run = run_compilation(
        db,
        circuit=circuit,
        created_by=username,
        transpile_config=body.model_dump(exclude_unset=True),
    )
    return _run_out(run)


@router.get("/compilation-runs/{run_id}", response_model=CompilationRunOut)
def get_compilation_run(
    run_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_dev_permission(role, "compilation:read")
    run = db.query(CompilationRunModel).filter(CompilationRunModel.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Compilation run not found")
    return _run_out(run)
