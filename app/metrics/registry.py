"""Canonical quantum infrastructure metrics (capability-aware, not all providers expose all)."""
from __future__ import annotations

from typing import Any, Dict, List

# metric_id → definition
METRIC_REGISTRY: Dict[str, Dict[str, Any]] = {
    "t1_us": {
        "name": "T1 coherence",
        "unit": "µs",
        "scope": "qubit",
        "description": "Energy relaxation time T1",
    },
    "t2_us": {
        "name": "T2 coherence (Ramsey)",
        "unit": "µs",
        "scope": "qubit",
        "description": "Dephasing time T2",
    },
    "t2_echo_us": {
        "name": "T2 echo",
        "unit": "µs",
        "scope": "qubit",
        "description": "Hahn echo T2 — distinct from Ramsey T2",
    },
    "readout_error": {
        "name": "Readout assignment error",
        "unit": "dimensionless",
        "scope": "qubit",
        "description": "Measurement misassignment probability",
    },
    "frequency_ghz": {
        "name": "Qubit frequency",
        "unit": "GHz",
        "scope": "qubit",
        "description": "Transition frequency where reported",
    },
    "gate_error_1q": {
        "name": "Single-qubit gate error",
        "unit": "dimensionless",
        "scope": "gate",
        "description": "1Q gate infidelity or error rate",
    },
    "gate_error_2q": {
        "name": "Two-qubit gate error",
        "unit": "dimensionless",
        "scope": "edge",
        "description": "2Q gate error on coupling edge",
    },
    "gate_duration_ns": {
        "name": "Gate duration",
        "unit": "ns",
        "scope": "gate",
        "description": "Pulse or gate length",
    },
    "queue_pending": {
        "name": "Queue depth",
        "unit": "jobs",
        "scope": "backend",
        "description": "Pending jobs at provider or proxy count",
    },
    "queue_wait_s": {
        "name": "Estimated queue wait",
        "unit": "s",
        "scope": "backend",
        "description": "Estimated wait until execution",
    },
    "calibration_timestamp": {
        "name": "Calibration timestamp",
        "unit": "datetime",
        "scope": "backend",
        "description": "Vendor calibration event time",
    },
    "topology_edges": {
        "name": "Coupling topology",
        "unit": "graph",
        "scope": "backend",
        "description": "Physical coupling edges between qubits",
    },
    "job_status": {
        "name": "Job lifecycle",
        "unit": "enum",
        "scope": "backend",
        "description": "Recent job status records from provider",
    },
}


def list_metrics() -> List[Dict[str, Any]]:
    return [{"metric_id": mid, **meta} for mid, meta in METRIC_REGISTRY.items()]
