import statistics
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.models.entities import (
    BackendModel, BackendTelemetryModel, CalibrationSnapshotModel,
    QubitTelemetryModel, QubitModel, GateTelemetryModel, AlertRuleModel,
)
from app.schemas.schemas import BackendHealthResponse
from app.monitoring.health_engine import HealthEngine
from app.analytics.health_vector import (
    HEALTH_MODEL_VERSION,
    T_GATE_US,
    T1_CRIT_US,
    evaluate_qubit,
    mean_or_none,
)
from app.analytics.health_explain import explain_backend, explain_qubit
from app.analytics.coherence_aggregate import backend_coherence_row, build_coherence_snapshot
from app.api.environment import env_severity_for
from app.core.audit_log import record_audit
from app.core.rbac import get_current_role, get_current_username, require_operator

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


class QuarantineBody(BaseModel):
    reason: Optional[str] = None


class CompareBackendsBody(BaseModel):
    backend_ids: List[str]


def _t1_crit(db: Session) -> float:
    rule = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == "rule_t1").first()
    if rule and rule.threshold_value:
        return float(rule.threshold_value)
    return T1_CRIT_US


def _latest_gates(db: Session, backend_id: str):
    latest_ts = (
        db.query(func.max(GateTelemetryModel.timestamp))
        .filter(GateTelemetryModel.backend_id == backend_id)
        .scalar()
    )
    if not latest_ts:
        return [], []
    # Each gate row gets its own utcnow(); take the collection burst, not one row.
    cutoff = latest_ts - timedelta(minutes=2)
    rows = (
        db.query(GateTelemetryModel)
        .filter(GateTelemetryModel.backend_id == backend_id, GateTelemetryModel.timestamp >= cutoff)
        .all()
    )
    g1, g2 = [], []
    for g in rows:
        if g.gate_error is None:
            continue
        nq = len(g.qubits or [])
        if nq <= 1:
            g1.append(g)
        else:
            g2.append(g)
    return g1, g2


def _gate_error_for(gates, qubit_index: int, fallback):
    for g in gates:
        if qubit_index in (g.qubits or []):
            return g.gate_error
    return fallback


def _t_gate_us(gates) -> float:
    durs = [g.gate_duration for g in gates if g.gate_duration]
    if not durs:
        return T_GATE_US
    # stored as ns in mock
    mean_ns = sum(durs) / len(durs)
    if mean_ns > 1.0:
        return mean_ns / 1000.0
    return mean_ns


@router.get("/vector")
def get_health_vector(db: Session = Depends(get_db)):
    from app.core.cache import cache_key, default_ttl, get_or_set_json
    from app.services.health_vector_builder import build_health_vector_payload

    ttl = default_ttl("health_vector", 10)
    key = cache_key("health", "vector")
    return get_or_set_json(key, ttl, lambda: build_health_vector_payload(db))


@router.post("/compare")
def compare_backends(body: CompareBackendsBody, db: Session = Depends(get_db)):
    """Side-by-side health vector + coherence for 2–4 backends (modality-aware)."""
    from app.analytics.backend_comparison import build_comparison

    ids = list(dict.fromkeys(body.backend_ids))
    if len(ids) < 2 or len(ids) > 4:
        raise HTTPException(status_code=400, detail="Select 2 to 4 distinct backend_ids")
    for bid in ids:
        if not db.query(BackendModel).filter(BackendModel.backend_id == bid).first():
            raise HTTPException(status_code=404, detail=f"Backend not found: {bid}")
    vec = get_health_vector(db)
    backends = db.query(BackendModel).all()
    coherence_rows = [backend_coherence_row(db, b) for b in backends]
    try:
        payload = build_comparison(vec["backends"], coherence_rows, ids)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Backend not in health vector: {e.args[0]}")
    payload["health_model_version"] = vec.get("health_model_version")
    return payload


@router.get("/coherence")
def get_coherence(db: Session = Depends(get_db)):
    """Per-backend T1/T2 from latest qubit telemetry, plus modality-grouped aggregates."""
    return build_coherence_snapshot(db)


@router.get("/modules")
def get_module_status():
    """FR-12 LIVE / STUB / NOT BUILT strip. Honest, not marketing."""
    return {
        "modules": [
            {"id": "observe", "name": "Observe (backends, qubits, jobs, queues)", "status": "LIVE"},
            {"id": "measure", "name": "Measure (T1/T2, readout, calibration age)", "status": "LIVE"},
            {"id": "compare", "name": "Compare (drift vs baseline)", "status": "LIVE"},
            {"id": "diagnose", "name": "Diagnose (4-D health vector)", "status": "LIVE"},
            {"id": "anomaly_ewma", "name": "Anomaly scan (EWMA / change-point)", "status": "LIVE"},
            {"id": "explain_health", "name": "Explainable health narratives", "status": "LIVE"},
            {"id": "temporal_replay", "name": "Temporal replay (synced panels)", "status": "LIVE"},
            {"id": "research_audit", "name": "Novelty audit + evidence Q&A", "status": "LIVE"},
            {"id": "decide", "name": "Decide (GREEN/YELLOW/RED router)", "status": "LIVE"},
            {"id": "act_quarantine", "name": "Act (qubit quarantine)", "status": "LIVE"},
            {"id": "record", "name": "Record (alerts, reports CSV/HTML/JSON)", "status": "LIVE"},
            {"id": "auth", "name": "Auth (register, PNG captcha, TOTP, optional LDAP bind)", "status": "LIVE"},
            {"id": "providers_live", "name": "Adapters IBM / Rigetti / IonQ / C-DAC", "status": "LIVE"},
            {"id": "providers_catalog", "name": "Credential slots (Braket, Azure, Google, …)", "status": "STUB"},
            {"id": "environment_import", "name": "Environment JSON import", "status": "LIVE"},
            {"id": "environment_adapter", "name": "Vendor cryo/RF (calibration-derived)", "status": "LIVE"},
            {"id": "router_hysteresis", "name": "Router hysteresis / dwell time", "status": "NOT_BUILT"},
            {"id": "opaque_score", "name": "Legacy 0–100 health score (kept, not primary)", "status": "LIVE"},
        ]
    }


@router.get("/explain")
def explain_fleet_health(db: Session = Depends(get_db)):
    """Structured narratives for each backend router decision."""
    vec = get_health_vector(db)
    t1_crit = vec.get("t1_crit_us", T1_CRIT_US)
    return {
        "health_model_version": vec.get("health_model_version"),
        "backends": [explain_backend(b, t1_crit=t1_crit) for b in vec.get("backends", [])],
    }


@router.get("/explain/{backend_id}")
def explain_backend_health(backend_id: str, db: Session = Depends(get_db)):
    vec = get_health_vector(db)
    t1_crit = vec.get("t1_crit_us", T1_CRIT_US)
    match = next((b for b in vec.get("backends", []) if b["backend_id"] == backend_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Backend not found in health vector")
    return explain_backend(match, t1_crit=t1_crit)


@router.get("/explain/{backend_id}/qubits/{qubit_index}")
def explain_qubit_health(backend_id: str, qubit_index: int, db: Session = Depends(get_db)):
    vec = get_health_vector(db)
    t1_crit = vec.get("t1_crit_us", T1_CRIT_US)
    match = next((b for b in vec.get("backends", []) if b["backend_id"] == backend_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Backend not found")
    q = next((x for x in match.get("qubits", []) if x["qubit_index"] == qubit_index), None)
    if not q:
        raise HTTPException(status_code=404, detail="Qubit not found")
    return explain_qubit(q, t1_crit=t1_crit)


@router.post("/qubits/{backend_id}/{idx}/quarantine")
def quarantine_qubit(
    backend_id: str,
    idx: int,
    body: QuarantineBody = None,
    db: Session = Depends(get_db),
    role: str = Depends(require_operator),
    username: str = Depends(get_current_username),
):
    q = (
        db.query(QubitModel)
        .filter(QubitModel.backend_id == backend_id, QubitModel.qubit_index == idx)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Qubit not found")
    q.status = "QUARANTINED"
    db.commit()
    reason = body.reason if body else None
    record_audit(
        "qubit.quarantine.advisory",
        actor=username,
        role=role,
        resource_type="qubit",
        resource_id=f"{backend_id}:{idx}",
        detail={"reason": reason, "scope": "local_database_only"},
    )
    return {
        "status": "QUARANTINED",
        "backend_id": backend_id,
        "qubit_index": idx,
        "reason": reason,
        "advisory": True,
        "scope": "local_database_only",
        "message": "Local advisory flag only — does not exclude qubits on vendor cloud schedulers.",
    }


@router.post("/qubits/{backend_id}/{idx}/release")
def release_qubit(
    backend_id: str,
    idx: int,
    db: Session = Depends(get_db),
    role: str = Depends(require_operator),
    username: str = Depends(get_current_username),
):
    q = (
        db.query(QubitModel)
        .filter(QubitModel.backend_id == backend_id, QubitModel.qubit_index == idx)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Qubit not found")
    q.status = "OPERATIONAL"
    db.commit()
    record_audit(
        "qubit.release.advisory",
        actor=username,
        role=role,
        resource_type="qubit",
        resource_id=f"{backend_id}:{idx}",
    )
    return {
        "status": "OPERATIONAL",
        "backend_id": backend_id,
        "qubit_index": idx,
        "advisory": True,
        "scope": "local_database_only",
    }


@router.post("/router/apply")
def apply_router(
    db: Session = Depends(get_db),
    role: str = Depends(require_operator),
    username: str = Depends(get_current_username),
):
    vec = get_health_vector(db)
    quarantined = []
    for b in vec["backends"]:
        for q in b["qubits"]:
            if q["state"] != "RED":
                continue
            entity = (
                db.query(QubitModel)
                .filter(QubitModel.backend_id == b["backend_id"], QubitModel.qubit_index == q["qubit_index"])
                .first()
            )
            if entity and entity.status != "QUARANTINED":
                entity.status = "QUARANTINED"
                quarantined.append({"backend_id": b["backend_id"], "qubit_index": q["qubit_index"]})
    db.commit()
    record_audit(
        "health.router.apply.advisory",
        actor=username,
        role=role,
        detail={"count": len(quarantined), "scope": "local_database_only"},
    )
    return {
        "status": "SUCCESS",
        "quarantined": quarantined,
        "count": len(quarantined),
        "advisory": True,
        "scope": "local_database_only",
        "message": "Local advisory flags only — not vendor scheduler exclusion.",
    }
