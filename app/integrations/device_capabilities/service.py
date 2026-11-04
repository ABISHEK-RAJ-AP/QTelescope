"""Assemble device capability sheets from the live fleet DB."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.provenance import MOCK_BACKEND_IDS
from app.discovery.hardware_discovery import ensure_discovered
from app.integrations.device_capabilities.mapper import map_backend_to_device_sheet
from app.integrations.device_capabilities.vocabulary import COVERAGE, SCHEMA_VERSION
from app.models.entities import (
    BackendModel,
    BackendTelemetryModel,
    CalibrationSnapshotModel,
    ConnectivityEdgeModel,
    GateTelemetryModel,
    JobRecordModel,
    QubitTelemetryModel,
)

KNOWN_PROVIDER_IDS = frozenset(
    {"ibm_quantum", "rigetti_quantum", "ionq_quantum", "cdac_quantum"}
)


def _fleet_backends(db: Session, backend_id: Optional[str] = None) -> List[BackendModel]:
    q = db.query(BackendModel).filter(BackendModel.provider_id.in_(KNOWN_PROVIDER_IDS))
    if settings.ENABLE_MOCK_DATA:
        q = q.filter(BackendModel.backend_id.in_(MOCK_BACKEND_IDS))
    if backend_id:
        q = q.filter(BackendModel.backend_id == backend_id)
    return q.all()


def _latest_telemetry_map(db: Session, backend_ids: List[str]) -> Dict[str, BackendTelemetryModel]:
    if not backend_ids:
        return {}
    subq = (
        db.query(
            BackendTelemetryModel.backend_id,
            func.max(BackendTelemetryModel.timestamp).label("max_ts"),
        )
        .filter(BackendTelemetryModel.backend_id.in_(backend_ids))
        .group_by(BackendTelemetryModel.backend_id)
        .subquery()
    )
    rows = (
        db.query(BackendTelemetryModel)
        .join(
            subq,
            and_(
                BackendTelemetryModel.backend_id == subq.c.backend_id,
                BackendTelemetryModel.timestamp == subq.c.max_ts,
            ),
        )
        .all()
    )
    return {r.backend_id: r for r in rows}


def _latest_cal_freshness(db: Session, backend_ids: List[str]) -> Dict[str, str]:
    if not backend_ids:
        return {}
    subq = (
        db.query(
            CalibrationSnapshotModel.backend_id,
            func.max(CalibrationSnapshotModel.timestamp).label("max_ts"),
        )
        .filter(CalibrationSnapshotModel.backend_id.in_(backend_ids))
        .group_by(CalibrationSnapshotModel.backend_id)
        .subquery()
    )
    rows = (
        db.query(CalibrationSnapshotModel)
        .join(
            subq,
            and_(
                CalibrationSnapshotModel.backend_id == subq.c.backend_id,
                CalibrationSnapshotModel.timestamp == subq.c.max_ts,
            ),
        )
        .all()
    )
    return {r.backend_id: r.freshness_status for r in rows}


def _latest_qubit_tel(db: Session, backend_id: str) -> List[Dict[str, Any]]:
    subq = (
        db.query(
            QubitTelemetryModel.qubit_index,
            func.max(QubitTelemetryModel.timestamp).label("max_ts"),
        )
        .filter(QubitTelemetryModel.backend_id == backend_id)
        .group_by(QubitTelemetryModel.qubit_index)
        .subquery()
    )
    rows = (
        db.query(QubitTelemetryModel)
        .join(
            subq,
            and_(
                QubitTelemetryModel.backend_id == backend_id,
                QubitTelemetryModel.qubit_index == subq.c.qubit_index,
                QubitTelemetryModel.timestamp == subq.c.max_ts,
            ),
        )
        .all()
    )
    return [
        {"qubit_index": r.qubit_index, "t1": r.t1, "t2": r.t2, "readout_error": r.readout_error}
        for r in rows
    ]


def _latest_gate_tel(db: Session, backend_id: str, limit: int = 64) -> List[Dict[str, Any]]:
    rows = (
        db.query(GateTelemetryModel)
        .filter(GateTelemetryModel.backend_id == backend_id)
        .order_by(GateTelemetryModel.timestamp.desc())
        .limit(limit * 3)
        .all()
    )
    out: List[Dict[str, Any]] = []
    seen = set()
    for r in rows:
        key = (r.gate_name, tuple(r.qubits or []))
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "gate_name": r.gate_name,
                "qubits": r.qubits or [],
                "gate_error": r.gate_error,
                "gate_duration": r.gate_duration,
            }
        )
        if len(out) >= limit:
            break
    return out


def build_device_sheets(
    db: Session,
    backend_id: Optional[str] = None,
    *,
    include_qubits: bool = True,
    include_gates: bool = True,
    include_jobs: bool = False,
    jobs_limit: int = 8,
) -> List[Dict[str, Any]]:
    ensure_discovered(db)
    backends = _fleet_backends(db, backend_id)
    if not backends:
        return []
    ids = [b.backend_id for b in backends]
    tel_map = _latest_telemetry_map(db, ids)
    cal_map = _latest_cal_freshness(db, ids)

    edge_rows = (
        db.query(ConnectivityEdgeModel)
        .filter(ConnectivityEdgeModel.backend_id.in_(ids))
        .all()
    )
    edges_by: Dict[str, List[Dict[str, Any]]] = {}
    for e in edge_rows:
        edges_by.setdefault(e.backend_id, []).append(
            {"source_qubit": e.source_qubit, "target_qubit": e.target_qubit}
        )

    out: List[Dict[str, Any]] = []
    for b in backends:
        lt = tel_map.get(b.backend_id)
        pending = int(lt.pending_jobs) if lt and lt.pending_jobs is not None else 0
        wait = lt.estimated_wait_time if lt else None
        qubits = _latest_qubit_tel(db, b.backend_id) if include_qubits else []
        gates = _latest_gate_tel(db, b.backend_id) if include_gates else []
        jobs = []
        if include_jobs:
            jrows = (
                db.query(JobRecordModel)
                .filter(JobRecordModel.backend_id == b.backend_id)
                .order_by(JobRecordModel.submitted_at.desc())
                .limit(jobs_limit)
                .all()
            )
            jobs = [{"job_id": j.job_id, "status": j.status} for j in jrows]

        out.append(
            map_backend_to_device_sheet(
                backend_id=b.backend_id,
                backend_name=b.backend_name,
                configuration_version=b.configuration_version,
                qubit_count=b.qubit_count or 0,
                operational_status=b.operational_status,
                pending_jobs=pending,
                estimated_wait_time=wait,
                freshness_status=cal_map.get(b.backend_id),
                basis_gates=b.basis_gates if isinstance(b.basis_gates, list) else None,
                coupling_edges=edges_by.get(b.backend_id, []),
                qubit_telemetry=qubits,
                gate_telemetry=gates,
                recent_jobs=jobs,
            )
        )
    return out


def coverage_report() -> Dict[str, Any]:
    return {
        "schema": SCHEMA_VERSION,
        "coverage": COVERAGE,
        "note": "Normalized device sheets for operators and exports. Product surface is Q-TeleScope.",
    }

