from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.connectors.compile_qiskit import compile_circuit
from app.models.entities import BackendModel
from app.services.governance_capacity import hardware_block_reason
from app.services.preflight_service import resolve_execution_target


def explain_device_selection(
    db: Session,
    *,
    source_text: str,
    source_language: str,
    project_capabilities: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    project_capabilities = project_capabilities or {}
    _, _, artifact, _, _ = compile_circuit(source_text, source_language)
    width = artifact.get("num_qubits") if artifact else None
    out: List[Dict[str, Any]] = []
    for b in db.query(BackendModel).order_by(BackendModel.backend_name).limit(100).all():
        target = resolve_execution_target(db, f"backend:{b.backend_id}")
        reasons: List[str] = []
        eligible = True
        if (b.backend_type or "").lower() != "hardware":
            reasons.append("Not classified as hardware backend")
            eligible = False
        if b.operational_status != "ONLINE":
            reasons.append(f"Status is {b.operational_status}")
            eligible = False
        if width is not None and b.qubit_count < width:
            reasons.append(f"Needs {width} qubits; backend has {b.qubit_count}")
            eligible = False
        if (b.backend_type or "").lower() == "hardware":
            block = hardware_block_reason(db, b.backend_id)
            if block:
                reasons.append(block)
                eligible = False
        if not project_capabilities.get("workload_submission", True):
            reasons.append("Project has workload submission disabled")
            eligible = False
        if eligible:
            reasons.append("Passes width and online checks")
        out.append(
            {
                "target_id": target["id"],
                "label": b.backend_name,
                "eligible": eligible,
                "reasons": reasons,
                "execution_class": target.get("execution_class"),
            }
        )
    out.insert(
        0,
        {
            "target_id": "simulator_local",
            "label": "Local CPU simulator",
            "eligible": project_capabilities.get("simulation_cpu", True) is not False,
            "reasons": ["Always available for development simulation"],
            "execution_class": "simulated",
        },
    )
    return out
