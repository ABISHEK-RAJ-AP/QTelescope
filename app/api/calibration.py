from collections import defaultdict
from statistics import fmean

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import CalibrationSnapshotModel, BackendModel, QubitTelemetryModel
from app.schemas.schemas import CalibrationSnapshotResponse

router = APIRouter(prefix="/calibration", tags=["Calibration"])

def _all_latest_calibrations(db: Session) -> List[CalibrationSnapshotResponse]:
    latest = (
        db.query(
            CalibrationSnapshotModel.backend_id,
            func.max(CalibrationSnapshotModel.timestamp).label("max_ts"),
        )
        .group_by(CalibrationSnapshotModel.backend_id)
        .subquery()
    )
    return (
        db.query(CalibrationSnapshotModel)
        .join(
            latest,
            (CalibrationSnapshotModel.backend_id == latest.c.backend_id)
            & (CalibrationSnapshotModel.timestamp == latest.c.max_ts),
        )
        .all()
    )


@router.get("", response_model=List[CalibrationSnapshotResponse])
def get_all_latest_calibrations(db: Session = Depends(get_db)):
    from app.core.cache import cache_get_json, cache_key, cache_set_json, default_ttl

    ttl = default_ttl("calibrations", 20)
    key = cache_key("fleet", "calibrations")
    cached = cache_get_json(key)
    if cached is not None:
        return [CalibrationSnapshotResponse.model_validate(x) for x in cached]
    rows = _all_latest_calibrations(db)
    payload = [CalibrationSnapshotResponse.model_validate(r).model_dump(mode="json") for r in rows]
    cache_set_json(key, payload, ttl)
    return [CalibrationSnapshotResponse.model_validate(r) for r in rows]

@router.get("/{backend_id}", response_model=CalibrationSnapshotResponse)
def get_latest_backend_calibration(backend_id: str, db: Session = Depends(get_db)):
    snap = (
        db.query(CalibrationSnapshotModel)
        .filter(CalibrationSnapshotModel.backend_id == backend_id)
        .order_by(CalibrationSnapshotModel.timestamp.desc())
        .first()
    )
    if not snap:
        raise HTTPException(status_code=404, detail="Calibration record not found for backend")
    return snap

@router.get("/{backend_id}/history", response_model=List[CalibrationSnapshotResponse])
def get_calibration_history(backend_id: str, limit: int = Query(30, ge=1, le=200), db: Session = Depends(get_db)):
    snaps = (
        db.query(CalibrationSnapshotModel)
        .filter(CalibrationSnapshotModel.backend_id == backend_id)
        .order_by(CalibrationSnapshotModel.timestamp.desc())
        .limit(limit)
        .all()
    )
    return snaps


@router.get("/{backend_id}/timeline")
def get_calibration_timeline(
    backend_id: str,
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Calibration events plus bucketed mean T1 for drift context (from stored telemetry)."""
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        raise HTTPException(status_code=404, detail="Backend not found")

    cal_snaps = (
        db.query(CalibrationSnapshotModel)
        .filter(CalibrationSnapshotModel.backend_id == backend_id)
        .order_by(CalibrationSnapshotModel.calibration_timestamp.desc())
        .limit(limit)
        .all()
    )
    telem = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id)
        .order_by(QubitTelemetryModel.timestamp.desc())
        .limit(800)
        .all()
    )
    buckets: dict = defaultdict(list)
    for row in telem:
        if row.t1 is None or not row.timestamp:
            continue
        key = row.timestamp.replace(second=0, microsecond=0).isoformat()
        buckets[key].append(row.t1)

    t1_series = [
        {"observed_at": ts, "t1_mean_us": round(fmean(vals), 3), "sample_count": len(vals)}
        for ts, vals in sorted(buckets.items())
    ][-limit:]

    events = [
        {
            "calibration_timestamp": s.calibration_timestamp.isoformat() if s.calibration_timestamp else None,
            "recorded_at": s.timestamp.isoformat() if s.timestamp else None,
            "freshness_status": s.freshness_status,
            "calibration_identifier": s.calibration_identifier,
            "calibration_age_hours": s.calibration_age,
        }
        for s in reversed(cal_snaps)
    ]

    return {
        "backend_id": backend_id,
        "backend_name": backend.backend_name,
        "calibration_events": events,
        "t1_mean_series": t1_series,
        "note": "Vertical calibration markers align to vendor calibration_timestamp; T1 series from collected qubit telemetry.",
    }
