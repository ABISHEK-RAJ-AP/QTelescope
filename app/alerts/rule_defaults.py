"""Default alert rule templates per backend (modality-aware T1/T2)."""
from __future__ import annotations

from typing import Any, Dict, List

from app.analytics.modality_thresholds import modality_profile, normalize_modality

_SHARED = [
    {
        "metric_name": "READOUT_ERROR",
        "operator": ">",
        "threshold_value": 0.08,
        "severity": "WARNING",
        "enabled": True,
        "description": "Readout error above limit",
    },
    {
        "metric_name": "QUEUE_JOBS",
        "operator": ">",
        "threshold_value": 50.0,
        "severity": "WARNING",
        "enabled": True,
        "description": "Queue backlog above limit",
    },
    {
        "metric_name": "CALIBRATION_AGE",
        "operator": ">",
        "threshold_value": 24.0,
        "severity": "WARNING",
        "enabled": True,
        "description": "Calibration older than limit (hours)",
    },
]


def default_rules_for_modality(modality: str | None) -> List[Dict[str, Any]]:
    prof = modality_profile(modality)
    mod = normalize_modality(modality)
    return [
        {
            "metric_name": "T1",
            "operator": "<",
            "threshold_value": float(prof["t1_crit_us"]),
            "severity": "CRITICAL",
            "enabled": True,
            "description": f"{mod}: T1 below limit (µs)",
        },
        {
            "metric_name": "T2",
            "operator": "<",
            "threshold_value": float(prof["t2_crit_us"]),
            "severity": "CRITICAL",
            "enabled": True,
            "description": f"{mod}: T2 below limit (µs)",
        },
        *_SHARED,
    ]


def rule_id_for(backend_id: str, metric_name: str) -> str:
    safe = backend_id.replace("/", "_").replace(" ", "_")
    return f"rule_{safe}_{metric_name.lower()}"


def default_rules_for_backend(backend_id: str, modality: str | None) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for spec in default_rules_for_modality(modality):
        out.append(
            {
                "rule_id": rule_id_for(backend_id, spec["metric_name"]),
                "backend_id": backend_id,
                **spec,
            }
        )
    return out