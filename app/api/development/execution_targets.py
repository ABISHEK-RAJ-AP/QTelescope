from fastapi import APIRouter, Depends, HTTPException

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role
from app.services.preflight_service import list_execution_targets, resolve_execution_target
from sqlalchemy.orm import Session

router = APIRouter(prefix="/execution-targets", tags=["execution-targets"])


@router.get("")
def get_execution_targets(db: Session = Depends(get_db), role: str = Depends(get_current_role)) -> dict:
    require_dev_permission(role, "studio:read")
    return {"targets": list_execution_targets(db)}


@router.get("/{target_id}/manifest")
def get_target_manifest(target_id: str, db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_dev_permission(role, "studio:read")
    target = resolve_execution_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return {
        "target_id": target["id"],
        "execution_class": target.get("execution_class"),
        "backend_type": target.get("backend_type"),
        "qubit_count": target.get("qubit_count"),
        "basis_gates": target.get("basis_gates"),
        "label": target.get("label"),
    }
