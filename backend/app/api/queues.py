from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.entities import BackendTelemetryModel, BackendModel
from app.schemas.schemas import QueueStatusResponse, QueueHistoryPoint

router = APIRouter(prefix="/queues", tags=["Queue Monitoring"])

@router.get("", response_model=List[QueueStatusResponse])
def get_all_queues(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    results = []
    
    for b in backends:
        latest = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == b.backend_id)
            .order_by(BackendTelemetryModel.timestamp.desc())
            .first()
        )
        pending = latest.pending_jobs if latest else 0
        wait = latest.estimated_wait_time if latest else 0.0
        
        # Determine condition & trend
        if pending > 40:
            cond = "CONGESTED"
        elif pending > 20:
            cond = "BUSY"
        elif pending > 5:
            cond = "MODERATE"
        else:
            cond = "OPTIMAL"

        results.append(QueueStatusResponse(
            backend_id=b.backend_id,
            backend_name=b.backend_name,
            pending_jobs=pending,
            estimated_wait_time=wait,
            queue_condition=cond,
            trend="STABLE",
            operational_status=b.operational_status,
            provider_id=b.provider_id,
            qubit_count=b.qubit_count
        ))
    return results

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
    pending = latest.pending_jobs if latest else 0
    wait = latest.estimated_wait_time if latest else 0.0
    cond = "CONGESTED" if pending > 40 else ("BUSY" if pending > 20 else ("MODERATE" if pending > 5 else "OPTIMAL"))

    return QueueStatusResponse(
        backend_id=b.backend_id,
        backend_name=b.backend_name,
        pending_jobs=pending,
        estimated_wait_time=wait,
        queue_condition=cond,
        trend="STABLE",
        operational_status=b.operational_status,
        provider_id=b.provider_id,
        qubit_count=b.qubit_count
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
