from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import BackendModel, BackendTelemetryModel, ConnectivityEdgeModel
from app.schemas.schemas import BackendResponse, BackendStatusResponse, ConnectivityEdgeResponse

from app.discovery.hardware_discovery import ensure_discovered

router = APIRouter(prefix="/backends", tags=["Backends"])

@router.get("", response_model=List[BackendResponse])
def get_backends(provider_id: Optional[str] = None, db: Session = Depends(get_db)):
    ensure_discovered(db)
    query = db.query(BackendModel)
    if provider_id:
        query = query.filter(BackendModel.provider_id == provider_id)
    return query.all()

@router.get("/{backend_id}", response_model=BackendResponse)
def get_backend_detail(backend_id: str, db: Session = Depends(get_db)):
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        raise HTTPException(status_code=404, detail="Backend not found")
    return backend

@router.get("/{backend_id}/status", response_model=BackendStatusResponse)
def get_backend_status(backend_id: str, db: Session = Depends(get_db)):
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        raise HTTPException(status_code=404, detail="Backend not found")
    
    latest_telemetry = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .first()
    )
    
    return BackendStatusResponse(
        backend_id=backend.backend_id,
        backend_name=backend.backend_name,
        operational_status=backend.operational_status,
        status_message=backend.status_message,
        pending_jobs=latest_telemetry.pending_jobs if latest_telemetry else 0,
        estimated_wait_time=latest_telemetry.estimated_wait_time if latest_telemetry else 0.0,
        updated_at=latest_telemetry.timestamp if latest_telemetry else backend.updated_at
    )

@router.get("/{backend_id}/telemetry")
def get_backend_telemetry_history(backend_id: str, limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    records = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "timestamp": r.timestamp,
            "operational": r.operational,
            "pending_jobs": r.pending_jobs,
            "estimated_wait_time": r.estimated_wait_time,
            "telemetry_source": r.telemetry_source
        }
        for r in reversed(records)
    ]

@router.get("/{backend_id}/connectivity", response_model=List[ConnectivityEdgeResponse])
def get_backend_connectivity(backend_id: str, db: Session = Depends(get_db)):
    edges = db.query(ConnectivityEdgeModel).filter(ConnectivityEdgeModel.backend_id == backend_id).all()
    return edges
