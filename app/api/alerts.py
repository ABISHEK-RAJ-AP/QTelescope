import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from collections import defaultdict
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.models.entities import AlertModel, IncidentAlertModel
from app.schemas.schemas import AlertResponse, AlertSummaryResponse, AlertAcknowledgeRequest, AlertResolveRequest
from app.core.rbac import get_current_username, require_permission
from app.core.audit_log import record_audit
from app.services.alert_comments import add_comment as add_alert_comment, list_comments as list_alert_comments

router = APIRouter(prefix="/alerts", tags=["Alerts & Events"])

def parse_alert_response(alert: AlertModel) -> AlertResponse:
    res_id = alert.resource_id or ""
    rtype = (alert.resource_type or "").upper()
    if rtype == "BACKEND":
        b_id = res_id
    elif "_Q" in res_id:
        b_id = res_id.rsplit("_Q", 1)[0]
    else:
        b_id = res_id

    return AlertResponse(
        alert_id=alert.alert_id,
        resource_type=alert.resource_type,
        resource_id=alert.resource_id,
        backend_id=b_id,
        alert_type=alert.alert_type,
        severity=alert.severity,
        message=alert.message,
        current_value=alert.current_value,
        threshold_value=alert.threshold_value,
        detected_at=alert.detected_at,
        status=alert.status,
        acknowledged_by=alert.acknowledged_by,
        resolved_at=alert.resolved_at
    )

@router.get("", response_model=List[AlertResponse])
def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    resource_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=50_000),
    db: Session = Depends(get_db)
):
    query = db.query(AlertModel)
    if status:
        query = query.filter(AlertModel.status == status)
    if severity:
        query = query.filter(AlertModel.severity == severity)
    if resource_id:
        query = query.filter(AlertModel.resource_id == resource_id)
        
    alerts = query.order_by(AlertModel.detected_at.desc()).offset(offset).limit(limit).all()
    return [parse_alert_response(a) for a in alerts]


def _build_alerts_summary(db: Session) -> AlertSummaryResponse:
    from sqlalchemy import func

    active_filter = AlertModel.status == "ACTIVE"
    critical = int(
        db.query(func.count())
        .filter(active_filter, AlertModel.severity == "CRITICAL")
        .scalar()
        or 0
    )
    warning = int(
        db.query(func.count())
        .filter(active_filter, AlertModel.severity == "WARNING")
        .scalar()
        or 0
    )
    active = int(db.query(func.count()).filter(active_filter).scalar() or 0)
    stored = int(db.query(func.count(AlertModel.alert_id)).scalar() or 0)
    stream = (
        db.query(AlertModel.severity, AlertModel.resource_id)
        .filter(active_filter)
        .yield_per(512)
    )
    by_backend: dict[str, int] = defaultdict(int)
    critical_by_backend: dict[str, int] = defaultdict(int)
    warning_by_backend: dict[str, int] = defaultdict(int)
    for severity, res_id in stream:
        b_id = res_id.rsplit("_Q", 1)[0] if res_id and "_Q" in res_id else (res_id or "")
        if severity == "CRITICAL" and b_id:
            critical_by_backend[b_id] += 1
        elif severity == "WARNING" and b_id:
            warning_by_backend[b_id] += 1
        if b_id:
            by_backend[b_id] += 1
    return AlertSummaryResponse(
        active=active,
        critical=critical,
        warning=warning,
        stored=stored,
        by_backend=dict(by_backend),
        critical_by_backend=dict(critical_by_backend),
        warning_by_backend=dict(warning_by_backend),
    )


@router.get("/summary", response_model=AlertSummaryResponse)
def get_alerts_summary(db: Session = Depends(get_db)):
    """Lightweight counts for nav badges and fleet rollups (no full alert payloads)."""
    from app.core.cache import cache_get_json, cache_key, cache_set_json, default_ttl

    ttl = default_ttl("alerts_summary", 8)
    key = cache_key("alerts", "summary")
    cached = cache_get_json(key)
    if cached is not None:
        return AlertSummaryResponse(**cached)
    summary = _build_alerts_summary(db)
    cache_set_json(key, summary.model_dump(), ttl)
    return summary


class AlertDetailResponse(AlertResponse):
    incident_id: Optional[str] = None
    comments: List[dict] = []


class AlertCommentBody(BaseModel):
    text: str


@router.get("/{alert_id}", response_model=AlertDetailResponse)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    link = db.query(IncidentAlertModel).filter(IncidentAlertModel.alert_id == alert_id).first()
    base = parse_alert_response(alert)
    return AlertDetailResponse(
        **base.model_dump(),
        incident_id=link.incident_id if link else None,
        comments=list_alert_comments(alert_id),
    )


@router.post("/{alert_id}/comments")
def post_alert_comment(
    alert_id: str,
    body: AlertCommentBody,
    db: Session = Depends(get_db),
    role: str = Depends(require_permission("alerts:comment")),
    actor: str = Depends(get_current_username),
):
    if not (body.text or "").strip():
        raise HTTPException(status_code=400, detail="Comment text required")
    if not db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first():
        raise HTTPException(status_code=404, detail="Alert not found")
    row = add_alert_comment(alert_id, author=actor, role=role, text=body.text)
    record_audit(
        "alert.comment",
        actor=actor,
        role=role,
        resource_type="alert",
        resource_id=alert_id,
        detail={"comment_id": row["comment_id"]},
    )
    return row


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: str,
    req: AlertAcknowledgeRequest,
    db: Session = Depends(get_db),
    actor: str = Depends(get_current_username),
    role: str = Depends(require_permission("alerts:acknowledge")),
):
    alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_by = req.acknowledged_by or actor
    db.commit()
    db.refresh(alert)
    from app.core.cache import invalidate_operational_cache

    invalidate_operational_cache()
    if (req.comment or "").strip():
        record_audit(
            "alert.acknowledge",
            actor=actor,
            role=role,
            resource_type="alert",
            resource_id=alert_id,
            detail={"comment": req.comment.strip()},
        )
    return parse_alert_response(alert)

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: str,
    body: AlertResolveRequest = AlertResolveRequest(),
    db: Session = Depends(get_db),
    actor: str = Depends(get_current_username),
    role: str = Depends(require_permission("alerts:resolve")),
):
    alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.status = "RESOLVED"
    alert.resolved_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(alert)
    from app.core.cache import invalidate_operational_cache

    invalidate_operational_cache()
    if (body.resolution_notes or "").strip():
        record_audit(
            "alert.resolve",
            actor=actor,
            role=role,
            resource_type="alert",
            resource_id=alert_id,
            detail={"resolution_notes": body.resolution_notes.strip()},
        )
    return parse_alert_response(alert)
