from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role
from app.core.tenant import get_current_tenant, require_project_tenant
from app.models.development import CircuitVersionModel
from app.services import development_service as dev_svc
from app.services.device_selection import explain_device_selection

router = APIRouter(prefix="/device-selection", tags=["device-selection"])


@router.get("")
def device_selection_explain(
    project_id: str = Query(...),
    circuit_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "studio:read")
    project = dev_svc.get_project(db, project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_tenant(project.tenant_id, tenant_id)
    if circuit_id:
        circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == circuit_id).first()
    else:
        circuit = (
            db.query(CircuitVersionModel)
            .filter(CircuitVersionModel.project_id == project_id, CircuitVersionModel.is_head.is_(True))
            .first()
        )
    if not circuit:
        raise HTTPException(status_code=400, detail="No circuit for selection explain")
    targets = explain_device_selection(
        db,
        source_text=circuit.source_text or "",
        source_language=circuit.source_language,
        project_capabilities=project.capabilities_json,
    )
    return {"project_id": project_id, "circuit_id": circuit.circuit_id, "targets": targets}
