from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import QubitTelemetryModel, BackendModel
from app.analytics.drift_analyzer import DriftAnalyzer
from app.schemas.schemas import MetricDriftSummary

router = APIRouter(prefix="/drift", tags=["Drift Analysis"])

@router.get("", response_model=List[MetricDriftSummary])
def get_all_drift_summaries(metric: str = Query("t1", pattern="^(t1|t2|readout_error)$"), db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    summaries = []
    
    for b in backends:
        # Check qubit 0 drift for high-level backend summary
        records = (
            db.query(QubitTelemetryModel)
            .filter(QubitTelemetryModel.backend_id == b.backend_id, QubitTelemetryModel.qubit_index == 0)
            .order_by(QubitTelemetryModel.timestamp.asc())
            .limit(100)
            .all()
        )
        series = [{"timestamp": r.timestamp, metric: getattr(r, metric)} for r in records]
        analysis = DriftAnalyzer.analyze_drift(series, metric_key=metric)
        
        summaries.append(MetricDriftSummary(
            backend_id=b.backend_id,
            qubit_index=0,
            metric_name=metric,
            latest_val=analysis["latest_val"],
            previous_val=analysis["previous_val"],
            abs_change=analysis["abs_change"],
            pct_change=analysis["pct_change"],
            drift_status=analysis["drift_status"],
            points=analysis["points"]
        ))
    return summaries

@router.get("/{backend_id}", response_model=MetricDriftSummary)
def get_backend_drift_summary(backend_id: str, metric: str = Query("t1", pattern="^(t1|t2|readout_error)$"), db: Session = Depends(get_db)):
    records = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id, QubitTelemetryModel.qubit_index == 0)
        .order_by(QubitTelemetryModel.timestamp.asc())
        .limit(100)
        .all()
    )
    series = [{"timestamp": r.timestamp, metric: getattr(r, metric)} for r in records]
    analysis = DriftAnalyzer.analyze_drift(series, metric_key=metric)
    
    return MetricDriftSummary(
        backend_id=backend_id,
        qubit_index=0,
        metric_name=metric,
        latest_val=analysis["latest_val"],
        previous_val=analysis["previous_val"],
        abs_change=analysis["abs_change"],
        pct_change=analysis["pct_change"],
        drift_status=analysis["drift_status"],
        points=analysis["points"]
    )

@router.get("/{backend_id}/qubits/{qubit_index}", response_model=MetricDriftSummary)
def get_qubit_drift_detail(backend_id: str, qubit_index: int, metric: str = Query("t1", pattern="^(t1|t2|readout_error)$"), db: Session = Depends(get_db)):
    records = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id, QubitTelemetryModel.qubit_index == qubit_index)
        .order_by(QubitTelemetryModel.timestamp.asc())
        .limit(100)
        .all()
    )
    series = [{"timestamp": r.timestamp, metric: getattr(r, metric)} for r in records]
    analysis = DriftAnalyzer.analyze_drift(series, metric_key=metric)
    
    return MetricDriftSummary(
        backend_id=backend_id,
        qubit_index=qubit_index,
        metric_name=metric,
        latest_val=analysis["latest_val"],
        previous_val=analysis["previous_val"],
        abs_change=analysis["abs_change"],
        pct_change=analysis["pct_change"],
        drift_status=analysis["drift_status"],
        points=analysis["points"]
    )
