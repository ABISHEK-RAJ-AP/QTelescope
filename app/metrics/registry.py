"""Canonical quantum infrastructure metrics (capability-aware, not all providers expose all)."""
from __future__ import annotations

from typing import Any, Dict, List

METRIC_GROUPS: List[Dict[str, Any]] = [
    {"id": "coherence", "label": "Coherence & readout", "description": "Per-qubit relaxation, dephasing, and measurement quality."},
    {"id": "gates", "label": "Gate performance", "description": "Gate errors and durations from calibration or health vector."},
    {"id": "operations", "label": "Operations & topology", "description": "Queue, jobs, calibration freshness, and coupling graph."},
]

# metric_id → definition
METRIC_REGISTRY: Dict[str, Dict[str, Any]] = {
    "t1_us": {
        "name": "T1 coherence",
        "unit": "µs",
        "scope": "qubit",
        "group": "coherence",
        "description": "Energy relaxation time T1",
    },
    "t2_us": {
        "name": "T2 coherence (Ramsey)",
        "unit": "µs",
        "scope": "qubit",
        "group": "coherence",
        "description": "Dephasing time T2",
    },
    "t2_echo_us": {
        "name": "T2 echo",
        "unit": "µs",
        "scope": "qubit",
        "group": "coherence",
        "description": "Hahn echo T2 — distinct from Ramsey T2",
    },
    "readout_error": {
        "name": "Readout assignment error",
        "unit": "dimensionless",
        "scope": "qubit",
        "group": "coherence",
        "description": "Measurement misassignment probability",
    },
    "frequency_ghz": {
        "name": "Qubit frequency",
        "unit": "GHz",
        "scope": "qubit",
        "group": "coherence",
        "description": "Transition frequency where reported",
    },
    "gate_error_1q": {
        "name": "Single-qubit gate error",
        "unit": "dimensionless",
        "scope": "gate",
        "group": "gates",
        "description": "1Q gate infidelity or error rate",
    },
    "gate_error_2q": {
        "name": "Two-qubit gate error",
        "unit": "dimensionless",
        "scope": "edge",
        "group": "gates",
        "description": "2Q gate error on coupling edge",
    },
    "gate_duration_ns": {
        "name": "Gate duration",
        "unit": "ns",
        "scope": "gate",
        "group": "gates",
        "description": "Pulse or gate length",
    },
    "queue_pending": {
        "name": "Queue depth",
        "unit": "jobs",
        "scope": "backend",
        "group": "operations",
        "description": "Pending jobs at provider or proxy count",
    },
    "queue_wait_s": {
        "name": "Estimated queue wait",
        "unit": "s",
        "scope": "backend",
        "group": "operations",
        "description": "Estimated wait until execution",
    },
    "calibration_timestamp": {
        "name": "Calibration timestamp",
        "unit": "datetime",
        "scope": "backend",
        "group": "operations",
        "description": "Vendor calibration event time",
    },
    "topology_edges": {
        "name": "Coupling topology",
        "unit": "graph",
        "scope": "backend",
        "group": "operations",
        "description": "Physical coupling edges between qubits",
    },
    "job_status": {
        "name": "Job lifecycle",
        "unit": "enum",
        "scope": "backend",
        "group": "operations",
        "description": "Recent job status records from provider",
    },
}


def list_metrics() -> List[Dict[str, Any]]:
    return [{"metric_id": mid, **meta} for mid, meta in METRIC_REGISTRY.items()]


def list_registry_groups() -> List[Dict[str, Any]]:
    """Groups with metric_ids ordered as in METRIC_REGISTRY."""
    by_group: Dict[str, List[str]] = {g["id"]: [] for g in METRIC_GROUPS}
    for mid, meta in METRIC_REGISTRY.items():
        gid = meta.get("group") or "operations"
        by_group.setdefault(gid, []).append(mid)
    out = []
    for g in METRIC_GROUPS:
        out.append({**g, "metric_ids": by_group.get(g["id"], [])})
    return out
