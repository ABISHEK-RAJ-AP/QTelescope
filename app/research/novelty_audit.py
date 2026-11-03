"""Code-backed novelty audit — no marketing claims without repo evidence."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

AUDIT_VERSION = "2026-10-31-s4.4"


def build_novelty_audit() -> Dict[str, Any]:
    differentiators: List[Dict[str, Any]] = [
        {
            "theme": "National federated observability",
            "status": "SHIPPED",
            "vs_typical_cloud_console": "Hub aggregates peer snapshots + local live DB; cloud consoles are single-vendor.",
            "evidence": ["app/federated/", "FEDERATED_OBSERVABILITY_DESIGN.md", "GET /federated/summary"],
        },
        {
            "theme": "Honest provenance & STUB labels",
            "status": "SHIPPED",
            "vs_typical_cloud_console": "telemetry_source live|simulated|stub; unsupported metrics ≠ zero.",
            "evidence": ["app/core/provenance.py", "app/metrics/", "DataProvenanceBar"],
        },
        {
            "theme": "Health vector v2 + explainability",
            "status": "SHIPPED",
            "vs_typical_cloud_console": "4-D router with confidence/δ_cal guards; narrative API.",
            "evidence": ["app/analytics/health_vector.py", "app/analytics/health_explain.py", "HEALTH_MODEL_V2_SPEC.md"],
        },
        {
            "theme": "Evidence ZIP + SHA-256 manifest",
            "status": "SHIPPED",
            "vs_typical_cloud_console": "Immutable bundle for lab audit; not just CSV export.",
            "evidence": ["app/evidence/snapshot_builder.py", "EVIDENCE_ARCHITECTURE.md"],
        },
        {
            "theme": "Air-gap / PARAM classical infra",
            "status": "SHIPPED",
            "vs_typical_cloud_console": "On-prem compose bundle + HPC host metrics for simulators.",
            "evidence": ["docker-compose.airgap.yml", "app/infra/classical_metrics.py", "deployment/airgap/"],
        },
        {
            "theme": "Modality-aware comparison",
            "status": "SHIPPED",
            "vs_typical_cloud_console": "Cross-modality T1 league tables blocked at API.",
            "evidence": ["app/analytics/backend_comparison.py", "POST /health/compare"],
        },
    ]

    gaps: List[Dict[str, str]] = [
        {"area": "Live cryo MQTT", "status": "PARTIAL", "note": "Optional FACILITY_MQTT_BROKER subscriber; REST/inbox always on"},
        {"area": "Live peer mesh federation", "status": "NOT_BUILT", "note": "Snapshot/URL pull v1"},
        {"area": "ML anomaly models", "status": "NOT_BUILT", "note": "EWMA/change-point statistical v1 only"},
        {"area": "Vendor scheduler control", "status": "NOT_BUILT", "note": "Advisory quarantine only"},
        {"area": "Full competitive deep-dive", "status": "PARTIAL", "note": "See COMPETITIVE_LANDSCAPE.md template"},
    ]

    research_opportunities: List[Dict[str, str]] = [
        {"id": "R1", "topic": "Cross-site signed evidence exchange", "rationale": "National NQM audit chain"},
        {"id": "R2", "topic": "Calibration change-point → incident correlation", "rationale": "Reduce alert noise"},
        {"id": "R3", "topic": "PARAM Slurm/Prometheus live classical metrics", "rationale": "Replace simulated HPC panel"},
        {"id": "R4", "topic": "Modality-specific health vector weights", "rationale": "Trapped-ion vs transmon thresholds"},
        {"id": "R5", "topic": "Open benchmark replay against evidence ZIPs", "rationale": "Reproducible national comparisons"},
    ]

    return {
        "audit_version": AUDIT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "product": "Q-TeleScope National Observability Platform",
        "methodology": "Claims tied to shipped paths in this repository; gaps explicitly NOT_BUILT.",
        "differentiators": differentiators,
        "capability_gaps": gaps,
        "research_opportunities": research_opportunities,
        "related_docs": [
            "NOVELTY_AUDIT.md",
            "RESEARCH_OPPORTUNITIES.md",
            "COMPETITIVE_LANDSCAPE.md",
            "FEATURE_STATUS_MATRIX.md",
        ],
    }
