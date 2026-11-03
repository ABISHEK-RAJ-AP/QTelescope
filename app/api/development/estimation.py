from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role
from app.models.development import CircuitVersionModel
from app.schemas.development import EstimationRequest, EstimationOut
from app.services.estimation_service import estimate_resources

router = APIRouter(tags=["estimation"])


@router.post("/circuits/{circuit_id}/estimate", response_model=EstimationOut)
def estimate_circuit(
    circuit_id: str,
    body: EstimationRequest,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_dev_permission(role, "estimation:run")
    circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == circuit_id).first()
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    result = estimate_resources(
        circuit.source_text or "",
        circuit.source_language,
        execution_target_id=body.execution_target_id,
        shots=body.shots,
        options=body.model_dump(exclude_unset=True),
    )
    return EstimationOut(circuit_id=circuit_id, **result)
