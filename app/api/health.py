from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.models.entities import BackendModel, QubitModel
from app.schemas.schemas import BackendHealthResponse
from app.analytics.health_vector import T1_CRIT_US
from app.analytics.health_explain import explain_backend, explain_qubit
from app.analytics.coherence_aggregate import backend_coherence_row, build_coherence_snapshot
from app.api.environment import env_severity_for
from app.core.audit_log import record_audit
from app.core.rbac import get_current_role, get_current_username, require_operator

router = APIRouter(prefix="/health", tags=["Resource Health"])

@router.get("/backends", response_model=List[BackendHealthResponse])
def get_all_backends_health(db: Session = Depends(get_db)):
    from app.services.health_vector_builder import cached_health_vector, legacy_backend_card

    payload = cached_health_vector(db)
    return [
        BackendHealthResponse(
            backend_id=row["backend_id"],
            backend_name=row["backend_name"],
            **legacy_backend_card(row),
        )
        for row in payload.get("backends") or []
    ]

@router.get("/backends/{backend_id}", response_model=BackendHealthResponse)
def get_backend_health_detail(backend_id: str, db: Session = Depends(get_db)):
    from app.services.health_vector_builder import backend_by_id, cached_health_vector, legacy_backend_card

    row = backend_by_id(cached_health_vector(db)).get(backend_id)
    if not row:
        raise HTTPException(status_code=404, detail="Backend not found")
    return BackendHealthResponse(
        backend_id=row["backend_id"],
        backend_name=row["backend_name"],
        **legacy_backend_card(row),
    )


class QuarantineBody(BaseModel):
    reason: Optional[str] = None


class CompareBackendsBody(BaseModel):
    backend_ids: List[str]


@router.get("/vector")
def get_health_vector(db: Session = Depends(get_db)):
    from app.services.health_vector_builder import cached_health_vector

    return cached_health_vector(db)


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
