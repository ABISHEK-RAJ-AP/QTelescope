from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.entities import QubitModel, QubitTelemetryModel
from app.schemas.schemas import QubitDetailResponse
from app.monitoring.health_engine import HealthEngine

router = APIRouter(prefix="/backends/{backend_id}/qubits", tags=["Qubits"])

@router.get("", response_model=List[QubitDetailResponse])
def get_backend_qubits(backend_id: str, db: Session = Depends(get_db)):
    qubits = db.query(QubitModel).filter(QubitModel.backend_id == backend_id).all()
    results = []
    
    for q in qubits:
        latest = (
            db.query(QubitTelemetryModel)
            .filter(QubitTelemetryModel.backend_id == backend_id, QubitTelemetryModel.qubit_index == q.qubit_index)
            .order_by(QubitTelemetryModel.timestamp.desc())
            .first()
        )
        t1 = latest.t1 if latest else None
        t2 = latest.t2 if latest else None
        ro = latest.readout_error if latest else None
        freq = latest.frequency if latest else None
        modality_m = latest.modality_metrics if latest else q.modality_metrics
        
        health = HealthEngine.evaluate_qubit_health(t1, t2, ro)
        
        results.append(QubitDetailResponse(
            qubit_id=q.qubit_id,
            backend_id=q.backend_id,
            qubit_index=q.qubit_index,
            status=q.status,
            latest_t1=t1,
            latest_t2=t2,
            latest_frequency=freq,
            latest_readout_error=ro,
            modality_metrics=modality_m,
            health_status=health,
            source_timestamp=latest.source_timestamp if latest else None
        ))
    return results

@router.get("/{qubit_index}", response_model=QubitDetailResponse)
def get_qubit_detail(backend_id: str, qubit_index: int, db: Session = Depends(get_db)):
    qubit = db.query(QubitModel).filter(QubitModel.backend_id == backend_id, QubitModel.qubit_index == qubit_index).first()
    if not qubit:
        raise HTTPException(status_code=404, detail="Qubit not found")
        
    latest = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id, QubitTelemetryModel.qubit_index == qubit_index)
        .order_by(QubitTelemetryModel.timestamp.desc())
        .first()
    )
    t1 = latest.t1 if latest else None
    t2 = latest.t2 if latest else None
    ro = latest.readout_error if latest else None
    freq = latest.frequency if latest else None
    modality_m = latest.modality_metrics if latest else qubit.modality_metrics
    health = HealthEngine.evaluate_qubit_health(t1, t2, ro)
    
    return QubitDetailResponse(
        qubit_id=qubit.qubit_id,
        backend_id=qubit.backend_id,
        qubit_index=qubit.qubit_index,
        status=qubit.status,
        latest_t1=t1,
        latest_t2=t2,
        latest_frequency=freq,
        latest_readout_error=ro,
        modality_metrics=modality_m,
        health_status=health,
        source_timestamp=latest.source_timestamp if latest else None
    )

@router.get("/{qubit_index}/history")
def get_qubit_history(backend_id: str, qubit_index: int, limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    records = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id, QubitTelemetryModel.qubit_index == qubit_index)
        .order_by(QubitTelemetryModel.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "timestamp": r.timestamp,
            "t1": r.t1,
            "t2": r.t2,
            "frequency": r.frequency,
            "readout_error": r.readout_error,
            "modality_metrics": r.modality_metrics,
            "data_quality": r.data_quality
        }
        for r in records
    ]
