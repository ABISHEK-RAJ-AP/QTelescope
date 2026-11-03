"""Which metrics each provider adapter can supply when live collection succeeds."""
from __future__ import annotations

from typing import Dict, List, Set

# Live wired providers + mock demo path
PROVIDER_METRICS: Dict[str, Set[str]] = {
    "ibm_quantum": {
        "t1_us", "t2_us", "readout_error", "frequency_ghz",
        "gate_error_1q", "gate_error_2q", "gate_duration_ns",
        "queue_pending", "queue_wait_s", "calibration_timestamp",
        "topology_edges", "job_status",
    },
    "rigetti_quantum": {
        "t1_us", "t2_us", "readout_error",
        "gate_error_1q", "gate_error_2q", "gate_duration_ns",
        "queue_pending", "calibration_timestamp", "topology_edges", "job_status",
    },
    "ionq_quantum": {
        "t1_us", "t2_us", "readout_error",
        "gate_error_1q", "gate_error_2q",
        "queue_pending", "queue_wait_s", "calibration_timestamp", "job_status",
    },
    "cdac_quantum": {
        "t1_us", "t2_us", "readout_error",
        "gate_error_1q", "gate_error_2q",
        "queue_pending", "calibration_timestamp", "topology_edges", "job_status",
    },
}

def provider_capability_matrix() -> List[dict]:
    from app.metrics.registry import METRIC_REGISTRY
    from app.providers.catalog import CATALOG

    rows = []
    for prov_id, metrics in sorted(PROVIDER_METRICS.items()):
        rows.append(
            {
                "provider_id": prov_id,
                "adapter": "live",
                "supported_metrics": sorted(metrics),
                "unsupported_metrics": sorted(set(METRIC_REGISTRY.keys()) - metrics),
            }
        )
    stub_ids = sorted(
        p["id"] for p in CATALOG if p.get("adapter") == "stub" and p["id"] not in PROVIDER_METRICS
    )
    for prov_id in stub_ids:
        rows.append(
            {
                "provider_id": prov_id,
                "adapter": "stub",
                "supported_metrics": [],
                "unsupported_metrics": sorted(METRIC_REGISTRY.keys()),
            }
        )
    return rows


def metrics_for_provider(provider_id: str) -> Set[str]:
    return set(PROVIDER_METRICS.get(provider_id, set()))
