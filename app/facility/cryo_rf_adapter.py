"""Vendor cryo / RF readings from cloud calibration properties (derived, not facility MQTT)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.models.entities import CalibrationSnapshotModel


def derive_calibration_samples(db: Session) -> List[Dict[str, Any]]:
    """Latest fridge temperature per backend from vendor calibration snapshots."""
    derived: List[Dict[str, Any]] = []
    snaps = (
        db.query(CalibrationSnapshotModel)
        .order_by(CalibrationSnapshotModel.timestamp.desc())
        .all()
    )
    seen: Set[str] = set()
    for snap in snaps:
        if snap.backend_id in seen:
            continue
        seen.add(snap.backend_id)
        summary = snap.metrics_summary or {}
        fridge = summary.get("fridge_temperature_mK")
        if fridge is None:
            continue
        derived.append(
            {
                "timestamp": snap.timestamp.isoformat() if snap.timestamp else None,
                "backend_id": snap.backend_id,
                "channel": "cryo_temp_mK",
                "value": float(fridge),
                "unit": "mK",
                "severity": None,
                "source": "vendor_calibration",
            }
        )
    return derived


def adapter_status(db: Session) -> Dict[str, Any]:
    samples = derive_calibration_samples(db)
    if samples:
        return {
            "status": "LIVE",
            "mode": "derived",
            "note": "Cryo mK from vendor calibration snapshots (IBM/Rigetti/mock props). Not a live cryostat sensor bus.",
            "backends_with_cryo": len(samples),
        }
    return {
        "status": "IDLE",
        "mode": "derived",
        "note": "No fridge_temperature_mK in calibration snapshots yet. Run collection or import facility JSON.",
        "backends_with_cryo": 0,
    }
