from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session
from typing import Dict, List
from statistics import fmean
from app.core.database import get_db
from app.models.entities import BackendTelemetryModel, BackendModel
from app.schemas.schemas import QueueStatusResponse, QueueHistoryPoint

router = APIRouter(prefix="/queues", tags=["Queue Monitoring"])


def _queue_condition(pending: int) -> str:
    if pending > 40:
        return "CONGESTED"
    if pending > 20:
        return "BUSY"
    if pending > 5:
        return "MODERATE"
    return "OPTIMAL"


def _latest_telemetry_map(db: Session) -> dict[str, BackendTelemetryModel]:
    subq = (
        db.query(
            BackendTelemetryModel.backend_id,
            func.max(BackendTelemetryModel.timestamp).label("max_ts"),
        )
        .group_by(BackendTelemetryModel.backend_id)
        .subquery()
    )
    rows = (
        db.query(BackendTelemetryModel)
        .join(
            subq,
            and_(
                BackendTelemetryModel.backend_id == subq.c.backend_id,
                BackendTelemetryModel.timestamp == subq.c.max_ts,
            ),
        )
        .all()
    )
    return {r.backend_id: r for r in rows}


@router.get("", response_model=List[QueueStatusResponse])
def get_all_queues(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    tel_map = _latest_telemetry_map(db)
    results = []
    for b in backends:
        latest = tel_map.get(b.backend_id)
        # No telemetry → unknown wait (not zero). Wait values come from stored
        # BackendTelemetry samples (often mock/simulated ingest) — not a live provider SLA.
        pending = int(latest.pending_jobs) if latest and latest.pending_jobs is not None else 0
        wait = latest.estimated_wait_time if latest and latest.estimated_wait_time is not None else None
        results.append(
            QueueStatusResponse(
                backend_id=b.backend_id,
                backend_name=b.backend_name,
                pending_jobs=pending,
                estimated_wait_time=wait,
                queue_condition=_queue_condition(pending) if latest else "UNKNOWN",
                trend="STABLE" if latest else "UNKNOWN",
                operational_status=b.operational_status,
                provider_id=b.provider_id,
                qubit_count=b.qubit_count,
            )
        )
    return results


@router.get("/history/bulk")
def get_all_queue_history_bulk(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> Dict[str, List[dict]]:
    """Queue history for every backend in one request."""
    backends = db.query(BackendModel.backend_id).all()
    out: Dict[str, List[dict]] = {}
    for (bid,) in backends:
        records = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == bid)
            .order_by(BackendTelemetryModel.timestamp.desc())
            .limit(limit)
            .all()
        )
        out[bid] = [
            {
                "timestamp": r.timestamp,
                "pending_jobs": r.pending_jobs,
                "estimated_wait_time": r.estimated_wait_time,
            }
            for r in reversed(records)
        ]
    return out

@router.get("/{backend_id}", response_model=QueueStatusResponse)
def get_backend_queue_status(backend_id: str, db: Session = Depends(get_db)):
    b = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Backend not found")
        
    latest = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .first()
    )
    pending = int(latest.pending_jobs) if latest and latest.pending_jobs is not None else 0
    wait = latest.estimated_wait_time if latest and latest.estimated_wait_time is not None else None
    return QueueStatusResponse(
        backend_id=b.backend_id,
        backend_name=b.backend_name,
        pending_jobs=pending,
        estimated_wait_time=wait,
        queue_condition=_queue_condition(pending) if latest else "UNKNOWN",
        trend="STABLE" if latest else "UNKNOWN",
        operational_status=b.operational_status,
        provider_id=b.provider_id,
        qubit_count=b.qubit_count,
    )

@router.get("/{backend_id}/history", response_model=List[QueueHistoryPoint])
def get_queue_history(backend_id: str, limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    records = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        QueueHistoryPoint(
            timestamp=r.timestamp,
            pending_jobs=r.pending_jobs,
            estimated_wait_time=r.estimated_wait_time
        )
        for r in reversed(records)
    ]


@router.get("/analytics/summary")
def get_queue_analytics_summary(db: Session = Depends(get_db)):
    """Pending and wait-time stats from stored backend telemetry (not vendor queue API depth)."""
    backends = db.query(BackendModel).all()
    rows_out = []
    for b in backends:
        history = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == b.backend_id)
            .order_by(BackendTelemetryModel.timestamp.desc())
            .limit(120)
            .all()
        )
        waits = [h.estimated_wait_time for h in history if h.estimated_wait_time is not None]
        pending = [h.pending_jobs for h in history if h.pending_jobs is not None]
        latest = history[0] if history else None
        rows_out.append(
            {
                "backend_id": b.backend_id,
                "backend_name": b.backend_name,
                "samples": len(history),
                "pending_current": latest.pending_jobs if latest else 0,
                "wait_current_s": latest.estimated_wait_time if latest else None,
                "pending_max": max(pending) if pending else None,
                "pending_mean": round(fmean(pending), 2) if pending else None,
                "wait_max_s": max(waits) if waits else None,
                "wait_mean_s": round(fmean(waits), 2) if waits else None,
                "telemetry_source_latest": latest.telemetry_source if latest else None,
            }
        )
    return {
        "note": "Derived from collected BackendTelemetryModel samples; sparse history lowers confidence.",
        "backends": rows_out,
    }
