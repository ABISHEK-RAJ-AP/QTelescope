"""Map Q-TeleScope backend/qubit/gate rows → device capability sheet."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from app.integrations.device_capabilities.vocabulary import DEVICE_STATUS, JOB_STATUS, SCHEMA_VERSION


def map_operational_status(
    operational_status: Optional[str],
    pending_jobs: int = 0,
    freshness_status: Optional[str] = None,
) -> str:
    raw = (operational_status or "").strip().upper()
    fresh = (freshness_status or "").strip().upper()

    if raw in ("ERROR", "FAULTY"):
        return "ERROR"
    if raw in ("OFFLINE", "DOWN"):
        return "OFFLINE"
    if raw in ("MAINTENANCE", "MAINT"):
        return "MAINTENANCE"
    if raw in ("CALIBRATION", "CALIBRATING") or fresh == "CALIBRATING":
        return "CALIBRATION"
    if raw in ("ONLINE", "UP", "AVAILABLE", "IDLE", "BUSY"):
        if pending_jobs and pending_jobs > 0:
            return "BUSY"
        return "IDLE"
    if not raw:
        return "OFFLINE"
    return "ERROR"


def map_job_status(status: Optional[str]) -> str:
    raw = (status or "").strip().upper()
    table = {
        "CREATED": "CREATED",
        "SUBMITTED": "SUBMITTED",
        "QUEUED": "QUEUED",
        "PENDING": "QUEUED",
        "RUNNING": "RUNNING",
        "IN_PROGRESS": "RUNNING",
        "COMPLETED": "DONE",
        "DONE": "DONE",
        "SUCCESS": "DONE",
        "CANCELLED": "CANCELED",
        "CANCELED": "CANCELED",
        "FAILED": "FAILED",
        "ERROR": "FAILED",
    }
    return table.get(raw, "FAILED" if raw else "CREATED")


def _fidelity_from_error(gate_error: Optional[float]) -> Optional[float]:
    if gate_error is None:
        return None
    try:
        e = float(gate_error)
    except (TypeError, ValueError):
        return None
    if e < 0:
        return None
    return max(0.0, min(1.0, 1.0 - e))


def _ns_to_us(duration_ns: Optional[float]) -> Optional[float]:
    if duration_ns is None:
        return None
    try:
        return float(duration_ns) / 1000.0
    except (TypeError, ValueError):
        return None


def map_backend_to_device_sheet(
    *,
    backend_id: str,
    backend_name: str,
    configuration_version: Optional[str] = None,
    qubit_count: int = 0,
    operational_status: Optional[str] = None,
    pending_jobs: int = 0,
    estimated_wait_time: Optional[float] = None,
    freshness_status: Optional[str] = None,
    basis_gates: Optional[Sequence[str]] = None,
    coupling_edges: Optional[Sequence[Dict[str, Any]]] = None,
    qubit_telemetry: Optional[Sequence[Dict[str, Any]]] = None,
    gate_telemetry: Optional[Sequence[Dict[str, Any]]] = None,
    recent_jobs: Optional[Sequence[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    status = map_operational_status(operational_status, pending_jobs, freshness_status)
    coupling: List[List[int]] = []
    for e in coupling_edges or []:
        try:
            coupling.append([int(e["source_qubit"]), int(e["target_qubit"])])
        except (KeyError, TypeError, ValueError):
            continue

    qubits: List[Dict[str, Any]] = []
    for q in qubit_telemetry or []:
        idx = q.get("qubit_index")
        if idx is None:
            continue
        qubits.append(
            {
                "index": int(idx),
                "t1_us": q.get("t1"),
                "t2_us": q.get("t2"),
            }
        )
    qubits.sort(key=lambda s: s["index"])

    gates: List[Dict[str, Any]] = []
    seen_ops: set = set()
    for g in gate_telemetry or []:
        name = g.get("gate_name") or g.get("name")
        if not name:
            continue
        qubit_list = g.get("qubits") or []
        key = (str(name), tuple(qubit_list) if isinstance(qubit_list, list) else ())
        if key in seen_ops:
            continue
        seen_ops.add(key)
        gates.append(
            {
                "name": str(name),
                "qubit_count": len(qubit_list) if isinstance(qubit_list, list) else None,
                "duration_us": _ns_to_us(g.get("gate_duration")),
                "fidelity": _fidelity_from_error(g.get("gate_error")),
                "qubits": qubit_list if isinstance(qubit_list, list) else None,
            }
        )
    if not gates and basis_gates:
        for name in basis_gates:
            gates.append(
                {
                    "name": str(name),
                    "qubit_count": None,
                    "duration_us": None,
                    "fidelity": None,
                    "qubits": None,
                }
            )

    jobs = []
    for j in recent_jobs or []:
        qs = map_job_status(j.get("status"))
        jobs.append(
            {
                "job_id": j.get("job_id"),
                "status": qs,
                "status_code": JOB_STATUS.get(qs),
            }
        )

    return {
        "backend_id": backend_id,
        "schema": SCHEMA_VERSION,
        "device": {
            "name": backend_name,
            "version": configuration_version or "unknown",
            "status": status,
            "status_code": DEVICE_STATUS.get(status),
            "qubit_count": int(qubit_count or 0),
            "queue_depth": int(pending_jobs or 0),
            "coupling_map": coupling,
            "duration_unit": "us",
            "duration_scale": 1.0,
            "qubits": qubits,
            "gates": gates,
        },
        "telemetry": {
            "operational_status": operational_status,
            "estimated_wait_time_s": estimated_wait_time,
            "calibration_freshness": freshness_status,
        },
        "recent_jobs": jobs,
    }

