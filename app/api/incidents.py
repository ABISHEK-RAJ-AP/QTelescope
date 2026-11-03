import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import AlertModel, IncidentAlertModel, IncidentModel
from app.schemas.schemas import AlertResponse
from app.api.alerts import parse_alert_response
from app.services.incident_service import sync_incidents_from_alerts
from app.services.incident_comments import add_comment, list_comments
from app.core.rbac import get_current_role, get_current_username, require_permission
from app.core.audit_log import record_audit

router = APIRouter(prefix="/incidents", tags=["Incidents"])


class IncidentResponse(BaseModel):
    incident_id: str
    title: str
    backend_id: str
    severity: str
    status: str
    summary: Optional[str] = None
    first_detected_at: datetime.datetime
    last_detected_at: datetime.datetime
    acknowledged_by: Optional[str] = None
    owner: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime.datetime] = None
    alert_count: int = 0
    alerts: List[AlertResponse] = []
    comments: List[dict] = []


class IncidentCommentBody(BaseModel):
    text: str


class IncidentAckBody(BaseModel):
    acknowledged_by: str = "operator"
    owner: Optional[str] = None
    comment: Optional[str] = None


class IncidentResolveBody(BaseModel):
    resolution_notes: str = ""


def _load_incident(db: Session, incident_id: str) -> IncidentModel:
    inc = db.query(IncidentModel).filter(IncidentModel.incident_id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


def _serialize(db: Session, inc: IncidentModel, include_alerts: bool = False) -> IncidentResponse:
    links = db.query(IncidentAlertModel).filter(IncidentAlertModel.incident_id == inc.incident_id).all()
    alert_ids = [l.alert_id for l in links]
    alerts: List[AlertResponse] = []
    if include_alerts and alert_ids:
        rows = db.query(AlertModel).filter(AlertModel.alert_id.in_(alert_ids)).all()
        alerts = [parse_alert_response(a) for a in rows]
    return IncidentResponse(
        incident_id=inc.incident_id,
        title=inc.title,
        backend_id=inc.backend_id,
        severity=inc.severity,
        status=inc.status,
        summary=inc.summary,
        first_detected_at=inc.first_detected_at,
        last_detected_at=inc.last_detected_at,
        acknowledged_by=inc.acknowledged_by,
        owner=inc.owner,
        resolution_notes=inc.resolution_notes,
        resolved_at=inc.resolved_at,
        alert_count=len(alert_ids),
        alerts=alerts,
        comments=list_comments(inc.incident_id),
    )


@router.post("/sync")
def sync_incidents(db: Session = Depends(get_db), _: str = Depends(require_permission("incidents:update"))):
    count = sync_incidents_from_alerts(db)
    return {"status": "SUCCESS", "incidents_updated": count}


@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    sync_incidents_from_alerts(db)
    q = db.query(IncidentModel).order_by(IncidentModel.last_detected_at.desc())
    if status:
        q = q.filter(IncidentModel.status == status.upper())
    rows = q.limit(limit).all()
    return [_serialize(db, inc) for inc in rows]


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = _load_incident(db, incident_id)
    return _serialize(db, inc, include_alerts=True)


@router.post("/{incident_id}/acknowledge", response_model=IncidentResponse)
def acknowledge_incident(
    incident_id: str,
    body: IncidentAckBody,
    db: Session = Depends(get_db),
    role: str = Depends(require_permission("incidents:update")),
    actor: str = Depends(get_current_username),
):
    inc = _load_incident(db, incident_id)
    inc.status = "ACKNOWLEDGED"
    inc.acknowledged_by = body.acknowledged_by or actor
    if body.owner:
        inc.owner = body.owner
    db.commit()
    db.refresh(inc)
    record_audit(
        "incident.acknowledge",
        actor=actor,
        role=role,
        resource_type="incident",
        resource_id=incident_id,
        detail={"comment": (body.comment or "").strip()} if (body.comment or "").strip() else {},
    )
    if (body.comment or "").strip():
        add_comment(incident_id, author=actor, role=role, text=body.comment.strip())
    return _serialize(db, inc, include_alerts=True)


@router.post("/{incident_id}/investigate", response_model=IncidentResponse)
def investigate_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(require_permission("incidents:update")),
    actor: str = Depends(get_current_username),
):
    inc = _load_incident(db, incident_id)
    inc.status = "INVESTIGATING"
    db.commit()
    db.refresh(inc)
    record_audit(
        "incident.investigate",
        actor=actor,
        role=role,
        resource_type="incident",
        resource_id=incident_id,
    )
    return _serialize(db, inc, include_alerts=True)


@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(
    incident_id: str,
    body: IncidentResolveBody,
    db: Session = Depends(get_db),
    role: str = Depends(require_permission("incidents:resolve")),
    actor: str = Depends(get_current_username),
):
    inc = _load_incident(db, incident_id)
    inc.status = "RESOLVED"
    inc.resolution_notes = body.resolution_notes or None
    inc.resolved_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(inc)
    record_audit(
        "incident.resolve",
        actor=actor,
        role=role,
        resource_type="incident",
        resource_id=incident_id,
        detail={"resolution_notes": body.resolution_notes or ""},
    )
    return _serialize(db, inc, include_alerts=True)


@router.post("/{incident_id}/comments")
def post_incident_comment(
    incident_id: str,
    body: IncidentCommentBody,
    db: Session = Depends(get_db),
    role: str = Depends(require_permission("incidents:comment")),
    actor: str = Depends(get_current_username),
):
    if not (body.text or "").strip():
        raise HTTPException(status_code=400, detail="Comment text required")
    _load_incident(db, incident_id)
    row = add_comment(incident_id, author=actor, role=role, text=body.text)
    record_audit(
        "incident.comment",
        actor=actor,
        role=role,
        resource_type="incident",
        resource_id=incident_id,
        detail={"comment_id": row["comment_id"]},
    )
    return row
