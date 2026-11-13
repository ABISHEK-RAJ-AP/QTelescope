"""QPU topology graph payload for interactive explorer."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import (
    BackendModel,
    ConnectivityEdgeModel,
    GateTelemetryModel,
    QubitModel,
    QubitTelemetryModel,
)
from app.services.health_vector_builder import (
    backend_by_id,
    cached_health_vector,
    health_label,
    qubit_state,
)

router = APIRouter(prefix="/backends", tags=["Topology"])


def _latest_gate_errors(db: Session, backend_id: str) -> dict:
    latest_ts = (
        db.query(func.max(GateTelemetryModel.timestamp))
        .filter(GateTelemetryModel.backend_id == backend_id)
        .scalar()
    )
    if not latest_ts:
        return {}
    cutoff = latest_ts - timedelta(minutes=5)
    rows = (
        db.query(GateTelemetryModel)
        .filter(GateTelemetryModel.backend_id == backend_id, GateTelemetryModel.timestamp >= cutoff)
        .all()
    )
    out = {}
    for g in rows:
        qs = g.qubits or []
        if len(qs) < 2:
            continue
        key = (min(qs), max(qs))
        if g.gate_error is not None:
            out[key] = g.gate_error
    return out


@router.get("/{backend_id}/topology")
def get_backend_topology(backend_id: str, db: Session = Depends(get_db)):
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        raise HTTPException(status_code=404, detail="Backend not found")

    qubits = db.query(QubitModel).filter(QubitModel.backend_id == backend_id).all()
    edges = db.query(ConnectivityEdgeModel).filter(ConnectivityEdgeModel.backend_id == backend_id).all()
    gate_err = _latest_gate_errors(db, backend_id)

    nodes = []
    row = backend_by_id(cached_health_vector(db)).get(backend_id) or {}
    for q in qubits:
        latest = (
            db.query(QubitTelemetryModel)
            .filter(
                QubitTelemetryModel.backend_id == backend_id,
                QubitTelemetryModel.qubit_index == q.qubit_index,
            )
            .order_by(QubitTelemetryModel.timestamp.desc())
            .first()
        )
        t1 = latest.t1 if latest else None
        t2 = latest.t2 if latest else None
        ro = latest.readout_error if latest else None
        health = health_label(qubit_state(row, q.qubit_index))
        nodes.append(
            {
                "id": str(q.qubit_index),
                "qubit_index": q.qubit_index,
                "status": q.status,
                "health_status": health,
                "t1_us": t1,
                "t2_us": t2,
                "readout_error": ro,
                "measurement_at": latest.timestamp.isoformat() if latest and latest.timestamp else None,
            }
        )

    links = []
    for e in edges:
        key = (min(e.source_qubit, e.target_qubit), max(e.source_qubit, e.target_qubit))
        links.append(
            {
                "edge_id": e.edge_id,
                "source": str(e.source_qubit),
                "target": str(e.target_qubit),
                "gate_error": gate_err.get(key),
            }
        )

    return {
        "backend_id": backend.backend_id,
        "backend_name": backend.backend_name,
        "qpu_modality": backend.qpu_modality,
        "topology_type": backend.topology_type,
        "qubit_count": backend.qubit_count,
        "node_count": len(nodes),
        "edge_count": len(links),
        "layout_hint": "force"
        if backend.topology_type in ("all_to_all", "fixed_graph", "heavy_hex")
        else "force",
        "nodes": nodes,
        "links": links,
    }
