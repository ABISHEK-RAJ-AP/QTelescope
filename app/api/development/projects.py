from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_role, get_current_username
from app.core.tenant import get_current_tenant
from app.api.development._auth import require_dev_permission
from app.schemas.development import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberOut,
    ProjectOut,
    ProjectUpdate,
)
from app.services import development_service as dev_svc
from app.services.submission_lock import active_submission_lock
from app.studio.platform_config import get_studio_platform_config

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_out(db: Session, p, tenant_id: str) -> ProjectOut:
    lock = active_submission_lock(db, p.project_id, tenant_id)
    return ProjectOut(**dev_svc.project_to_dict(p, submission_lock=lock))


@router.get("/catalog/templates")
def list_templates(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    require_dev_permission(role, "studio:read")
    return {"templates": get_studio_platform_config()["templates"]}


@router.get("", response_model=List[ProjectOut])
def list_projects(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:read")
    rows = dev_svc.list_projects(db, tenant_id, include_archived=include_archived)
    return [_project_out(db, p, tenant_id) for p in rows]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:create")
    project, _ = dev_svc.create_project(
        db,
        tenant_id=tenant_id,
        owner_username=username,
        name=body.name,
        description=body.description,
        project_type=body.project_type,
        template_id=body.template_id,
        slug=body.slug,
        settings=body.settings,
        capabilities=body.capabilities,
        tags=body.tags,
        metadata=body.metadata,
    )
    return _project_out(db, project, tenant_id)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:read")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_out(db, p, tenant_id)


@router.patch("/{project_id}", response_model=ProjectOut)
def patch_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:update")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if active_submission_lock(db, project_id, tenant_id):
        raise HTTPException(status_code=409, detail="Project locked while submission is in governance review")
    patch = body.model_dump(exclude_unset=True)
    updated = dev_svc.update_project(db, p, patch)
    return _project_out(db, updated, tenant_id)


@router.get("/{project_id}/members", response_model=List[ProjectMemberOut])
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:read")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    from app.models.development import DevProjectMemberModel

    rows = (
        db.query(DevProjectMemberModel)
        .filter(DevProjectMemberModel.project_id == project_id)
        .order_by(DevProjectMemberModel.created_at.asc())
        .all()
    )
    return rows


@router.post("/{project_id}/members", status_code=201)
def add_member(
    project_id: str,
    body: ProjectMemberAdd,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:update")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    from app.models.development import DevProjectMemberModel

    exists = (
        db.query(DevProjectMemberModel)
        .filter(DevProjectMemberModel.project_id == project_id, DevProjectMemberModel.username == body.username)
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Member already on project")
    db.add(DevProjectMemberModel(project_id=project_id, username=body.username, role=body.role))
    db.commit()
    return {"ok": True}


@router.delete("/{project_id}/members/{username}")
def remove_member(
    project_id: str,
    username: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:update")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    from app.models.development import DevProjectMemberModel

    row = (
        db.query(DevProjectMemberModel)
        .filter(DevProjectMemberModel.project_id == project_id, DevProjectMemberModel.username == username)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    if row.role == "owner":
        raise HTTPException(status_code=409, detail="Cannot remove project owner")
    db.delete(row)
    db.commit()
    return {"ok": True, "removed": username}


@router.get("/{project_id}/settings-schema")
def project_settings_schema(
    project_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    require_dev_permission(role, "projects:read")
    p = dev_svc.get_project(db, project_id, tenant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    catalog = get_studio_platform_config()
    return {
        "project_id": project_id,
        "effective_settings": p.settings_json,
        "effective_capabilities": p.capabilities_json,
        "platform_settings_schema": catalog["settings_schema"],
        "platform_features": catalog["features"],
        "editor_options": catalog["editor"],
        "simulation_options": catalog["simulation"],
    }
