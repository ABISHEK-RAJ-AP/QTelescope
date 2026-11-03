"""Compare registry + provider capability to actual stored telemetry."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.metrics.capabilities import metrics_for_provider
from app.metrics.registry import METRIC_REGISTRY
from app.models.entities import (
    BackendModel,
    BackendTelemetryModel,
    CalibrationSnapshotModel,
    ConnectivityEdgeModel,
    GateTelemetryModel,
    JobRecordModel,
    QubitTelemetryModel,
)


def _latest_qubit_sample(db: Session, backend_id: str) -> Optional[QubitTelemetryModel]:
    return (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id)
        .order_by(QubitTelemetryModel.timestamp.desc())
        .first()
    )


def backend_metric_coverage(db: Session, backend_id: str) -> Dict[str, Any]:
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        return {"backend_id": backend_id, "error": "not_found"}

    supported = metrics_for_provider(backend.provider_id)
    q = _latest_qubit_sample(db, backend_id)
    bt = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .first()
    )
    cal = (
        db.query(CalibrationSnapshotModel)
        .filter(CalibrationSnapshotModel.backend_id == backend_id)
        .order_by(CalibrationSnapshotModel.timestamp.desc())
        .first()
    )
    edges = db.query(ConnectivityEdgeModel).filter(ConnectivityEdgeModel.backend_id == backend_id).count()
    jobs = db.query(JobRecordModel).filter(JobRecordModel.backend_id == backend_id).count()
    g1 = (
        db.query(GateTelemetryModel)
        .filter(GateTelemetryModel.backend_id == backend_id)
        .order_by(GateTelemetryModel.timestamp.desc())
        .first()
    )

    observed: Dict[str, bool] = {
        "t1_us": q is not None and q.t1 is not None,
        "t2_us": q is not None and q.t2 is not None,
        "readout_error": q is not None and q.readout_error is not None,
        "frequency_ghz": q is not None and q.frequency is not None,
        "gate_error_1q": g1 is not None and g1.gate_error is not None and len(g1.qubits or []) <= 1,
        "gate_error_2q": g1 is not None and g1.gate_error is not None and len(g1.qubits or []) > 1,
        "gate_duration_ns": g1 is not None and g1.gate_duration is not None,
        "queue_pending": bt is not None,
        "queue_wait_s": bt is not None and bt.estimated_wait_time is not None,
        "calibration_timestamp": cal is not None,
        "topology_edges": edges > 0,
        "job_status": jobs > 0,
        "t2_echo_us": False,
    }

    metrics: List[dict] = []
    for metric_id, meta in METRIC_REGISTRY.items():
        if metric_id not in supported:
            state = "unsupported"
        elif observed.get(metric_id):
            state = "present"
        else:
            state = "missing"
        metrics.append(
            {
                "metric_id": metric_id,
                "name": meta["name"],
                "unit": meta["unit"],
                "scope": meta["scope"],
                "state": state,
            }
        )

    present_n = sum(1 for m in metrics if m["state"] == "present")
    return {
        "backend_id": backend_id,
        "backend_name": backend.backend_name,
        "provider_id": backend.provider_id,
        "qpu_modality": backend.qpu_modality,
        "supported_count": len(supported),
        "present_count": present_n,
        "metrics": metrics,
        "note": "missing ≠ zero — unsupported metrics are not collected by adapter.",
    }
