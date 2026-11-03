"""Fleet-wide anomaly scan over stored qubit telemetry."""
from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.analytics.anomaly_detector import analyze_metric_series
from app.models.entities import BackendModel, QubitModel, QubitTelemetryModel

METRICS = ("t1", "t2", "readout_error")


def _series_for(db: Session, backend_id: str, qubit_index: int, metric: str, limit: int = 80):
    rows = (
        db.query(QubitTelemetryModel)
        .filter(
            QubitTelemetryModel.backend_id == backend_id,
            QubitTelemetryModel.qubit_index == qubit_index,
        )
        .order_by(QubitTelemetryModel.timestamp.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [{"timestamp": r.timestamp, metric: getattr(r, metric)} for r in rows]


def scan_fleet_anomalies(
    db: Session,
    metric: str = "t1",
    max_backends: int = 32,
    qubits_per_backend: int = 16,
) -> Dict[str, Any]:
    if metric not in METRICS:
        metric = "t1"
    backends = db.query(BackendModel).limit(max_backends).all()
    hits: List[Dict[str, Any]] = []
    watch: List[Dict[str, Any]] = []
    scanned = 0
    insufficient = 0

    for b in backends:
        qubits = (
            db.query(QubitModel.qubit_index)
            .filter(QubitModel.backend_id == b.backend_id)
            .order_by(QubitModel.qubit_index.asc())
            .limit(qubits_per_backend)
            .all()
        )
        indices = [q[0] for q in qubits] or [0]
        for qi in indices:
            scanned += 1
            series = _series_for(db, b.backend_id, qi, metric)
            result = analyze_metric_series(series, metric_key=metric)
            if result["status"] == "INSUFFICIENT_DATA":
                insufficient += 1
                continue
            row = {
                "backend_id": b.backend_id,
                "backend_name": b.backend_name,
                "qubit_index": qi,
                "metric": metric,
                "status": result["status"],
                "latest_value": result.get("latest_value"),
                "latest_ewma": result.get("latest_ewma"),
                "latest_z": result.get("latest_z"),
                "change_point_index": result.get("change_point_index"),
                "flag_count": len(result.get("flags") or []),
            }
            if result["status"] in ("ANOMALY", "WARNING", "CHANGE_POINT"):
                hits.append(row)
            elif result.get("latest_z") is not None:
                watch.append(row)

    hits.sort(key=lambda h: (0 if h["status"] == "ANOMALY" else 1, -h.get("flag_count", 0)))
    watch.sort(key=lambda h: -(h.get("latest_z") or 0))
    return {
        "metric": metric,
        "backends_scanned": len(backends),
        "series_scanned": scanned,
        "insufficient_series": insufficient,
        "anomaly_count": sum(1 for h in hits if h["status"] == "ANOMALY"),
        "warning_count": sum(1 for h in hits if h["status"] == "WARNING"),
        "hits": hits[:50],
        "watch_list": watch[:8],
        "methodology": "EWMA + change-point on stored telemetry; not vendor calibration verdict.",
    }
