"""Evidence-only Q&A — DB + manifests only; no generative speculation."""
from __future__ import annotations

import re
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.core.deployment import deployment_profile
from app.models.entities import (
    AlertModel,
    BackendModel,
    EvidenceSnapshotModel,
    IncidentModel,
)
from app.research.novelty_audit import build_novelty_audit


def _cite(source: str, detail: Any = None) -> Dict[str, Any]:
    return {"source": source, "detail": detail}


def answer_from_evidence(db: Session, question: str) -> Dict[str, Any]:
    q = (question or "").strip()
    if not q:
        return {
            "answer": "Ask a question about fleet data, incidents, alerts, evidence snapshots, deployment, or novelty audit.",
            "citations": [],
            "mode": "evidence_only",
            "refused": True,
        }

    ql = q.lower()
    citations: List[Dict[str, Any]] = []

    if re.search(r"how many.*backend|backend.*count|number of backend", ql):
        n = db.query(BackendModel).count()
        online = db.query(BackendModel).filter(BackendModel.operational_status == "ONLINE").count()
        citations.append(_cite("backends_table", {"total": n, "online": online}))
        return {
            "answer": f"The database registers {n} backends ({online} ONLINE).",
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    if "incident" in ql and ("open" in ql or "how many" in ql):
        n = (
            db.query(IncidentModel)
            .filter(IncidentModel.status.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"]))
            .count()
        )
        citations.append(_cite("incidents_table", {"open": n}))
        return {
            "answer": f"There are {n} open incidents (OPEN/ACKNOWLEDGED/INVESTIGATING).",
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    if "alert" in ql and ("active" in ql or "how many" in ql):
        n = db.query(AlertModel).filter(AlertModel.status == "ACTIVE").count()
        citations.append(_cite("alerts_table", {"active": n}))
        return {
            "answer": f"There are {n} active alerts in the database.",
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    if "evidence" in ql or "snapshot" in ql:
        snaps = db.query(EvidenceSnapshotModel).order_by(EvidenceSnapshotModel.created_at.desc()).limit(5).all()
        citations.append(
            _cite(
                "evidence_snapshots",
                [
                    {
                        "snapshot_id": s.snapshot_id,
                        "package_sha256": s.package_sha256,
                        "scope": s.scope_backend_id,
                    }
                    for s in snaps
                ],
            )
        )
        if not snaps:
            return {
                "answer": "No evidence snapshots stored yet. Generate one from Reports → Evidence.",
                "citations": citations,
                "mode": "evidence_only",
                "refused": False,
            }
        latest = snaps[0]
        return {
            "answer": (
                f"Latest evidence snapshot {latest.snapshot_id} "
                f"(SHA-256 {latest.package_sha256[:16]}…). {len(snaps)} recent rows cited."
            ),
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    if ("air" in ql and "gap" in ql) or "airgap" in ql or "deployment" in ql:
        prof = deployment_profile()
        citations.append(_cite("deployment_profile", prof))
        return {
            "answer": (
                f"Deployment profile is {prof['profile']}. "
                f"Outbound vendor APIs: {prof['outbound_vendor_apis']}. "
                f"{prof['operator_notes']}"
            ),
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    if "novel" in ql or "different" in ql or "audit" in ql or "research" in ql:
        audit = build_novelty_audit()
        shipped = [d["theme"] for d in audit["differentiators"] if d["status"] == "SHIPPED"]
        citations.append(_cite("novelty_audit", {"shipped_themes": shipped[:6]}))
        return {
            "answer": (
                f"Novelty audit {audit['audit_version']} lists {len(shipped)} shipped differentiators "
                f"(e.g. {shipped[0]}). Full audit: GET /research/novelty-audit."
            ),
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    if "federat" in ql or "national" in ql:
        citations.append(_cite("api_hint", "/federated/summary"))
        return {
            "answer": "National federated totals live at GET /api/v1/federated/summary (local DB + peer snapshots).",
            "citations": citations,
            "mode": "evidence_only",
            "refused": False,
        }

    return {
        "answer": (
            "Out of evidence scope. I only use this deployment's DB and audit artifacts. "
            "Try: backend count, open incidents, active alerts, evidence snapshots, air-gap deployment, novelty audit."
        ),
        "citations": [],
        "mode": "evidence_only",
        "refused": True,
    }
