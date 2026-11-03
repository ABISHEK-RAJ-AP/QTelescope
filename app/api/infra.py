from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.infra.classical_metrics import classical_infra_for_backend, list_classical_infra
from app.models.entities import BackendModel

router = APIRouter(prefix="/infra", tags=["Classical infrastructure"])


@router.get("/classical")
def get_fleet_classical_infra(db: Session = Depends(get_db)):
    return {"backends": list_classical_infra(db)}


@router.get("/classical/{backend_id}")
def get_backend_classical_infra(backend_id: str, db: Session = Depends(get_db)):
    b = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Backend not found")
    row = classical_infra_for_backend(
        b.backend_id, b.provider_id, b.backend_type, b.qubit_count or 64
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail="Classical infra metrics apply to C-DAC / PARAM simulator backends only",
        )
    row["backend_name"] = b.backend_name
    return row
