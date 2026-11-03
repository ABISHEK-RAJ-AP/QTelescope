"""Delete a backend and all dependent rows (FK-safe order)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import (
    BackendModel,
    BackendTelemetryModel,
    CalibrationSnapshotModel,
    ConnectivityEdgeModel,
    GateModel,
    GateTelemetryModel,
    IncidentAlertModel,
    IncidentModel,
    JobRecordModel,
    QubitModel,
    QubitTelemetryModel,
)


def purge_backend(db: Session, backend_id: str) -> None:
    inc_ids = [
        r[0]
        for r in db.query(IncidentModel.incident_id).filter(IncidentModel.backend_id == backend_id).all()
    ]
    if inc_ids:
        db.query(IncidentAlertModel).filter(IncidentAlertModel.incident_id.in_(inc_ids)).delete(
            synchronize_session=False
        )
    db.query(IncidentModel).filter(IncidentModel.backend_id == backend_id).delete()
    db.query(GateTelemetryModel).filter(GateTelemetryModel.backend_id == backend_id).delete()
    db.query(QubitTelemetryModel).filter(QubitTelemetryModel.backend_id == backend_id).delete()
    db.query(BackendTelemetryModel).filter(BackendTelemetryModel.backend_id == backend_id).delete()
    db.query(CalibrationSnapshotModel).filter(CalibrationSnapshotModel.backend_id == backend_id).delete()
    db.query(JobRecordModel).filter(JobRecordModel.backend_id == backend_id).delete()
    db.query(ConnectivityEdgeModel).filter(ConnectivityEdgeModel.backend_id == backend_id).delete()
    db.query(QubitModel).filter(QubitModel.backend_id == backend_id).delete()
    db.query(GateModel).filter(GateModel.backend_id == backend_id).delete()
    db.query(BackendModel).filter(BackendModel.backend_id == backend_id).delete()
