from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.core.tenant import get_current_tenant
from app.services.submission_lock import active_submission_lock
from app.api.development._auth import require_dev_permission
from app.models.development import CircuitVersionModel
from app.schemas.development import CircuitCreate, CircuitOut
from app.services import development_service as dev_svc

router = APIRouter(prefix="/circuits", tags=["circuits"])


@router.get("/project/{project_id}", response_model=List[CircuitOut])
def list_circuits(
    project_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    require_dev_permission(role, "circuits:read")
    rows = (
        db.query(CircuitVersionModel)
        .filter(CircuitVersionModel.project_id == project_id)
        .order_by(CircuitVersionModel.version_number.desc())
        .all()
    )
    return [
        CircuitOut(
            circuit_id=c.circuit_id,
            project_id=c.project_id,
            name=c.name,
            version_number=c.version_number,
            source_language=c.source_language,
            content_hash=c.content_hash,
            source_text=c.source_text,
            metadata=c.metadata_json or {},
            is_head=c.is_head,
            created_by=c.created_by,
            created_at=c.created_at,
        )
        for c in rows
    ]


@router.post("/project/{project_id}", response_model=CircuitOut, status_code=201)
def create_circuit(
    project_id: str,
    body: CircuitCreate,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "circuits:update")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if active_submission_lock(db, project_id, tenant_id):
        raise HTTPException(status_code=409, detail="Circuit edits locked while submission is in governance review")
    c = dev_svc.add_circuit_version(
        db,
        project_id=project_id,
        name=body.name,
        source_language=body.source_language,
        source_text=body.source_text,
        created_by=username,
        metadata=body.metadata,
    )
    return CircuitOut(
        circuit_id=c.circuit_id,
        project_id=c.project_id,
        name=c.name,
        version_number=c.version_number,
        source_language=c.source_language,
        content_hash=c.content_hash,
        source_text=c.source_text,
        metadata=c.metadata_json or {},
        is_head=c.is_head,
        created_by=c.created_by,
        created_at=c.created_at,
    )


@router.get("/{circuit_id}", response_model=CircuitOut)
def get_circuit(circuit_id: str, db: Session = Depends(get_db), role: str = Depends(get_current_role)):
    require_dev_permission(role, "circuits:read")
    c = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == circuit_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Circuit not found")
    return CircuitOut(
        circuit_id=c.circuit_id,
        project_id=c.project_id,
        name=c.name,
        version_number=c.version_number,
        source_language=c.source_language,
        content_hash=c.content_hash,
        source_text=c.source_text,
        metadata=c.metadata_json or {},
        is_head=c.is_head,
        created_by=c.created_by,
        created_at=c.created_at,
    )
