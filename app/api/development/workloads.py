from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.development._auth import require_dev_permission
from app.core.database import get_db
from app.core.rbac import get_current_role
from app.core.tenant import get_current_tenant
from app.services import development_service as dev_svc

router = APIRouter(prefix="/workloads", tags=["workloads"])


@router.get("/{workload_id}/timeline")
def workload_timeline(
    workload_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    require_dev_permission(role, "simulation:read")
    from app.models.development import WorkloadModel

    wl = (
        db.query(WorkloadModel)
        .filter(WorkloadModel.workload_id == workload_id, WorkloadModel.tenant_id == tenant_id)
        .first()
    )
    if not wl:
        raise HTTPException(status_code=404, detail="Workload not found")
    events = dev_svc.list_workload_timeline(db, workload_id)
    items: List[Dict[str, Any]] = [
        {
            "event_id": e.event_id,
            "event_type": e.event_type,
            "source_system": e.source_system,
            "payload": e.payload_json or {},
            "created_at": e.created_at,
        }
        for e in events
    ]
    return {"workload_id": workload_id, "events": items}
