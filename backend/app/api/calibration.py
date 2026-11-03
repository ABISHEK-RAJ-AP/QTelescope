from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import CalibrationSnapshotModel, BackendModel
from app.schemas.schemas import CalibrationSnapshotResponse

router = APIRouter(prefix="/calibration", tags=["Calibration"])

@router.get("", response_model=List[CalibrationSnapshotResponse])
def get_all_latest_calibrations(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    results = []
    for b in backends:
        snap = (
            db.query(CalibrationSnapshotModel)
            .filter(CalibrationSnapshotModel.backend_id == b.backend_id)
            .order_by(CalibrationSnapshotModel.timestamp.desc())
            .first()
        )
        if snap:
            results.append(snap)
    return results

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
