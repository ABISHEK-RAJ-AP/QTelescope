import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import AlertModel
from app.schemas.schemas import AlertResponse, AlertAcknowledgeRequest

router = APIRouter(prefix="/alerts", tags=["Alerts & Events"])

def parse_alert_response(alert: AlertModel) -> AlertResponse:
    res_id = alert.resource_id or ""
    if "_Q" in res_id:
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
    db: Session = Depends(get_db)
):
    query = db.query(AlertModel)
    if status:
        query = query.filter(AlertModel.status == status)
    if severity:
        query = query.filter(AlertModel.severity == severity)
    if resource_id:
        query = query.filter(AlertModel.resource_id == resource_id)
        
    alerts = query.order_by(AlertModel.detected_at.desc()).limit(limit).all()
    return [parse_alert_response(a) for a in alerts]

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: str, req: AlertAcknowledgeRequest, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_by = req.acknowledged_by
    db.commit()
    db.refresh(alert)
    return parse_alert_response(alert)

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.status = "RESOLVED"
    alert.resolved_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return parse_alert_response(alert)
