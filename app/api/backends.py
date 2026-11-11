from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import BackendModel, BackendTelemetryModel, ConnectivityEdgeModel
from app.schemas.schemas import BackendResponse, BackendStatusResponse, ConnectivityEdgeResponse

from app.core.config import settings
from app.core.provenance import MOCK_BACKEND_IDS
from app.discovery.hardware_discovery import ensure_discovered
from app.services.backend_catalog import get_catalog_entry

router = APIRouter(prefix="/backends", tags=["Backends"])


def _backend_response(backend: BackendModel) -> BackendResponse:
    base = BackendResponse.model_validate(backend)
    meta = get_catalog_entry(backend.backend_id, provider_id=backend.provider_id)
    return base.model_copy(update=meta)

KNOWN_PROVIDER_IDS = frozenset(
    {"ibm_quantum", "rigetti_quantum", "ionq_quantum", "cdac_quantum"}
)


def _fleet_query(db: Session):
    q = db.query(BackendModel).filter(BackendModel.provider_id.in_(KNOWN_PROVIDER_IDS))
    if settings.ENABLE_MOCK_DATA:
        hardware_ids = {
            row[0]
            for row in db.query(BackendModel.backend_id).filter(
                BackendModel.provider_id.in_(KNOWN_PROVIDER_IDS),
                BackendModel.backend_type != "simulator",
            ).all()
        }
        allowed = set(MOCK_BACKEND_IDS) | hardware_ids
        q = q.filter(BackendModel.backend_id.in_(allowed))
    return q


@router.get("", response_model=List[BackendResponse])
def get_backends(provider_id: Optional[str] = None, db: Session = Depends(get_db)):
    ensure_discovered(db)
    query = _fleet_query(db)
    if provider_id:
        query = query.filter(BackendModel.provider_id == provider_id)
    return [_backend_response(b) for b in query.all()]


@router.get("/status-all", response_model=List[BackendStatusResponse])
def get_all_backend_status(db: Session = Depends(get_db)):
    """Latest operational telemetry for every backend (one round trip)."""
    ensure_discovered(db)
    backends = _fleet_query(db).all()
    if not backends:
        return []
    subq = (
        db.query(
            BackendTelemetryModel.backend_id,
            func.max(BackendTelemetryModel.timestamp).label("max_ts"),
        )
        .group_by(BackendTelemetryModel.backend_id)
        .subquery()
    )
    latest_rows = (
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
    tel_map = {r.backend_id: r for r in latest_rows}
    out: List[BackendStatusResponse] = []
    for b in backends:
        lt = tel_map.get(b.backend_id)
        out.append(
            BackendStatusResponse(
                backend_id=b.backend_id,
                backend_name=b.backend_name,
                operational_status=b.operational_status,
                status_message=b.status_message,
                pending_jobs=lt.pending_jobs if lt else 0,
                estimated_wait_time=lt.estimated_wait_time if lt else 0.0,
                updated_at=lt.timestamp if lt else b.updated_at,
            )
        )
    return out


@router.get("/{backend_id}", response_model=BackendResponse)
def get_backend_detail(backend_id: str, db: Session = Depends(get_db)):
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        raise HTTPException(status_code=404, detail="Backend not found")
    return _backend_response(backend)

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
