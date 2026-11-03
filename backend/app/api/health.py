from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.entities import BackendModel, BackendTelemetryModel, CalibrationSnapshotModel, QubitTelemetryModel, QubitModel
from app.schemas.schemas import BackendHealthResponse, QubitHealthSummary
from app.monitoring.health_engine import HealthEngine
from app.monitoring.freshness import CalibrationFreshnessMonitor

router = APIRouter(prefix="/health", tags=["Resource Health"])

@router.get("/backends", response_model=List[BackendHealthResponse])
def get_all_backends_health(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    results = []
    
    for b in backends:
        latest_st = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == b.backend_id)
            .order_by(BackendTelemetryModel.timestamp.desc())
            .first()
        )
        latest_calib = (
            db.query(CalibrationSnapshotModel)
            .filter(CalibrationSnapshotModel.backend_id == b.backend_id)
            .order_by(CalibrationSnapshotModel.timestamp.desc())
            .first()
        )
        
        # Latest qubits telemetry
        q_telemetry = []
        qubits = db.query(QubitModel).filter(QubitModel.backend_id == b.backend_id).all()
        for q in qubits:
            qt = (
                db.query(QubitTelemetryModel)
                .filter(QubitTelemetryModel.backend_id == b.backend_id, QubitTelemetryModel.qubit_index == q.qubit_index)
                .order_by(QubitTelemetryModel.timestamp.desc())
                .first()
            )
            if qt:
                q_telemetry.append({"t1": qt.t1, "t2": qt.t2, "readout_error": qt.readout_error})

        op = b.operational_status == "ONLINE"
        st_msg = b.status_message or "Operational"
        freshness = latest_calib.freshness_status if latest_calib else "Unknown"
        age_hrs = latest_calib.calibration_age if latest_calib else 9999.0
        pending = latest_st.pending_jobs if latest_st else 0

        eval_res = HealthEngine.evaluate_backend_health(
            operational=op,
            status_msg=st_msg,
            calibration_freshness=freshness,
            calibration_age_hours=age_hrs,
            pending_jobs=pending,
            qubits_telemetry=q_telemetry
        )

        results.append(BackendHealthResponse(
            backend_id=b.backend_id,
            backend_name=b.backend_name,
            overall_health=eval_res["overall_health"],
            health_score=eval_res["health_score"],
            contributing_factors=eval_res["contributing_factors"]
        ))

    return results

@router.get("/backends/{backend_id}", response_model=BackendHealthResponse)
def get_backend_health_detail(backend_id: str, db: Session = Depends(get_db)):
    b = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Backend not found")
        
    latest_st = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id == backend_id)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .first()
    )
    latest_calib = (
        db.query(CalibrationSnapshotModel)
        .filter(CalibrationSnapshotModel.backend_id == backend_id)
        .order_by(CalibrationSnapshotModel.timestamp.desc())
        .first()
    )
    
    q_telemetry = []
    qubits = db.query(QubitModel).filter(QubitModel.backend_id == backend_id).all()
    for q in qubits:
        qt = (
            db.query(QubitTelemetryModel)
            .filter(QubitTelemetryModel.backend_id == backend_id, QubitTelemetryModel.qubit_index == q.qubit_index)
            .order_by(QubitTelemetryModel.timestamp.desc())
            .first()
        )
        if qt:
            q_telemetry.append({"t1": qt.t1, "t2": qt.t2, "readout_error": qt.readout_error})

    op = b.operational_status == "ONLINE"
    st_msg = b.status_message or "Operational"
    freshness = latest_calib.freshness_status if latest_calib else "Unknown"
    age_hrs = latest_calib.calibration_age if latest_calib else 9999.0
    pending = latest_st.pending_jobs if latest_st else 0

    eval_res = HealthEngine.evaluate_backend_health(
        operational=op,
        status_msg=st_msg,
        calibration_freshness=freshness,
        calibration_age_hours=age_hrs,
        pending_jobs=pending,
        qubits_telemetry=q_telemetry
    )

    return BackendHealthResponse(
        backend_id=b.backend_id,
        backend_name=b.backend_name,
        overall_health=eval_res["overall_health"],
        health_score=eval_res["health_score"],
        contributing_factors=eval_res["contributing_factors"]
    )
