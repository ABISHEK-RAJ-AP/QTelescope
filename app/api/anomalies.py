from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.analytics.anomaly_detector import analyze_metric_series
from app.core.database import get_db
from app.models.entities import BackendModel, QubitTelemetryModel
from app.services.anomaly_scan import scan_fleet_anomalies

router = APIRouter(prefix="/anomalies", tags=["Anomaly detection"])

_METRIC_PATTERN = "^(t1|t2|readout_error)$"


@router.get("/summary")
def get_anomaly_summary(
    metric: str = Query("t1", pattern=_METRIC_PATTERN),
    db: Session = Depends(get_db),
):
    return scan_fleet_anomalies(db, metric=metric)


@router.get("/{backend_id}/qubits/{qubit_index}")
def get_qubit_anomalies(
    backend_id: str,
    qubit_index: int,
    metric: str = Query("t1", pattern=_METRIC_PATTERN),
    db: Session = Depends(get_db),
):
    if not db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first():
        raise HTTPException(status_code=404, detail="Backend not found")
    rows = (
        db.query(QubitTelemetryModel)
        .filter(
            QubitTelemetryModel.backend_id == backend_id,
            QubitTelemetryModel.qubit_index == qubit_index,
        )
        .order_by(QubitTelemetryModel.timestamp.asc())
        .limit(120)
        .all()
    )
    series = [{"timestamp": r.timestamp, metric: getattr(r, metric)} for r in rows]
    out = analyze_metric_series(series, metric_key=metric)
    out["backend_id"] = backend_id
    out["qubit_index"] = qubit_index
    return out
