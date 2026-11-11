import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.alerts import _build_alerts_summary
from app.api.queues import _latest_telemetry_map
from app.core.database import get_db
from app.models.entities import BackendModel, JobRecordModel
from app.schemas.schemas import FleetSummaryResponse

router = APIRouter(prefix="/fleet", tags=["Fleet"])


@router.get("/summary", response_model=FleetSummaryResponse)
def get_fleet_summary(db: Session = Depends(get_db)):
    """Single contract for dashboard/inventory KPIs (see docs/audit/METRIC_CONTRACTS.md)."""
    total_b = int(db.query(func.count(BackendModel.backend_id)).scalar() or 0)
    online_b = int(
        db.query(func.count(BackendModel.backend_id))
        .filter(BackendModel.operational_status == "ONLINE")
        .scalar()
        or 0
    )
    alert_sum = _build_alerts_summary(db)
    tel_map = _latest_telemetry_map(db)
    pending_telemetry = sum(
        int(r.pending_jobs)
        for r in tel_map.values()
        if r.pending_jobs is not None
    )
    queued = int(
        db.query(func.count())
        .filter(JobRecordModel.status == "QUEUED")
        .scalar()
        or 0
    )
    return FleetSummaryResponse(
        as_of=datetime.datetime.now(datetime.timezone.utc),
        total_backends=total_b,
        operational_backends=online_b,
        alerts_active=alert_sum.active,
        alerts_critical=alert_sum.critical,
        alerts_warning=alert_sum.warning,
        alerts_stored=alert_sum.stored,
        pending_jobs_telemetry=pending_telemetry,
        queued_jobs_execution=queued,
    )
