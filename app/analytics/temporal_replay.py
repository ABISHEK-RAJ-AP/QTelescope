"""Temporal replay — synced panels from stored telemetry (not vendor time-travel)."""
from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.analytics.health_vector import mean_or_none
from app.models.entities import (
    BackendModel,
    BackendTelemetryModel,
    CalibrationSnapshotModel,
    QubitTelemetryModel,
)

# Qubit rows are written after backend status in the same cycle; align to latest batch ≤ frame.
_BATCH_SLACK = timedelta(seconds=90)


def coherence_panel_at(at, qubit_rows) -> Dict[str, Any]:
    best_ts = None
    for qr in qubit_rows:
        if qr.timestamp <= at:
            best_ts = qr.timestamp
        else:
            break
    if best_ts is None:
        return {
            "t1_mean_us": None,
            "t2_mean_us": None,
            "qubit_samples": 0,
            "coherence_as_of": None,
        }
    batch_floor = best_ts - _BATCH_SLACK
    t1s, t2s = [], []
    for qr in qubit_rows:
        if qr.timestamp > at:
            break
        if qr.timestamp < batch_floor:
            continue
        if qr.t1 is not None:
            t1s.append(qr.t1)
        if qr.t2 is not None:
            t2s.append(qr.t2)
    return {
        "t1_mean_us": mean_or_none(t1s),
        "t2_mean_us": mean_or_none(t2s),
        "qubit_samples": len(t1s),
        "coherence_as_of": best_ts.isoformat() if best_ts else None,
    }


def build_replay_timeline(db: Session, backend_id: str, limit: int = 80) -> Dict[str, Any]:
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        return {"error": "not_found"}

    # Newest N samples, then chronological order for playback (asc limit alone returns stale tail).
    backend_rows = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .limit(limit)
        .all()
    )
    backend_rows.reverse()
    if not backend_rows:
        return {
            "backend_id": backend_id,
            "backend_name": backend.backend_name,
            "frame_count": 0,
            "frames": [],
            "methodology": "Replay uses collected BackendTelemetry timestamps as master clock.",
        }

    qubit_rows = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id)
        .order_by(QubitTelemetryModel.timestamp.asc())
        .all()
    )
    cal_rows = (
        db.query(CalibrationSnapshotModel)
        .filter(CalibrationSnapshotModel.backend_id == backend_id)
        .order_by(CalibrationSnapshotModel.timestamp.asc())
        .all()
    )

    frames: List[Dict[str, Any]] = []
    for i, bt in enumerate(backend_rows):
        at = bt.timestamp
        cal = None
        for c in cal_rows:
            if c.timestamp <= at:
                cal = c
            else:
                break

        coherence = coherence_panel_at(at, qubit_rows)

        frames.append(
            {
                "index": i,
                "at": at.isoformat() if at else None,
                "panels": {
                    "queue": {
                        "pending_jobs": bt.pending_jobs,
                        "estimated_wait_time": bt.estimated_wait_time,
                        "telemetry_source": bt.telemetry_source,
                        "data_quality": bt.data_quality,
                    },
                    "coherence": coherence,
                    "calibration": {
                        "freshness_status": cal.freshness_status if cal else None,
                        "calibration_identifier": cal.calibration_identifier if cal else None,
                        "calibration_age_hours": cal.calibration_age if cal else None,
                        "calibration_timestamp": (
                            cal.calibration_timestamp.isoformat()
                            if cal and cal.calibration_timestamp
                            else None
                        ),
                    },
                },
            }
        )

    return {
        "backend_id": backend_id,
        "backend_name": backend.backend_name,
        "frame_count": len(frames),
        "frames": frames,
        "telemetry_source": "replay",
        "methodology": (
            "Synced panels at each stored backend telemetry sample; "
            "qubit means from the latest properties batch at or before each frame."
        ),
    }


def get_frame(timeline: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
    frames = timeline.get("frames") or []
    if index < 0 or index >= len(frames):
        return None
    return frames[index]
