from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.connectors.compile_qiskit import compile_circuit
from app.models.development import PreflightReportModel
from app.models.entities import BackendModel
from app.schemas.epistemic import EpistemicValue


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ep_exact(value: Any, method: str, tool_version: Optional[str] = None) -> Dict[str, Any]:
    return EpistemicValue(
        value=value,
        value_kind="exact",
        method=method,
        tool_version=tool_version,
        computed_at=_utcnow(),
    ).model_dump(mode="json")


def _ep_unavailable(notes: str) -> Dict[str, Any]:
    return EpistemicValue(value_kind="unavailable", notes=notes).model_dump(mode="json")


def resolve_execution_target(db: Session, target_id: str) -> Dict[str, Any]:
    if target_id in ("simulator_local", "simulator_cpu") or target_id.startswith("simulator_"):
        return {
            "id": target_id,
            "execution_class": "simulated",
            "label": "CPU simulator",
            "backend_type": "simulator",
            "qubit_count": None,
            "basis_gates": None,
        }
    backend_key = target_id.removeprefix("backend:")
    row = db.query(BackendModel).filter(BackendModel.backend_id == backend_key).first()
    if row:
        return {
            "id": target_id if target_id.startswith("backend:") else f"backend:{row.backend_id}",
            "execution_class": "hardware",
            "label": row.backend_name,
            "backend_type": row.backend_type,
            "qubit_count": row.qubit_count,
            "basis_gates": row.basis_gates or [],
            "backend_id": row.backend_id,
        }
    return {
        "id": target_id,
        "execution_class": "simulated",
        "label": target_id,
        "backend_type": "simulator",
        "qubit_count": None,
        "basis_gates": None,
        "notes": "Unknown target — treated as simulator preflight",
    }


def run_preflight(
    db: Session,
    *,
    project_id: str,
    circuit_id: str,
    source_text: str,
    source_language: str,
    execution_target_id: str,
    created_by: str,
    options: Optional[Dict[str, Any]] = None,
) -> PreflightReportModel:
    options = options or {}
    target = resolve_execution_target(db, execution_target_id)
    status, diagnostics, artifact, tool, tool_version = compile_circuit(
        source_text,
        source_language,
        optimization_level=int(options.get("optimization_level", 1)),
        basis_gates=target.get("basis_gates") if target.get("execution_class") == "hardware" else None,
    )
    violations: List[Dict[str, Any]] = []
    for d in diagnostics:
        if d.get("severity") == "error":
            violations.append({"code": "compile_error", "detail": d.get("message"), "line": d.get("line")})

    metrics: Dict[str, Any] = {
        "execution_class": _ep_exact(target["execution_class"], "execution_target.resolve"),
        "num_qubits": _ep_unavailable("Compile did not produce width"),
        "depth": _ep_unavailable("Compile did not produce depth"),
        "cx_count": _ep_unavailable("Compile did not produce op counts"),
    }
    if artifact:
        if artifact.get("num_qubits") is not None:
            metrics["num_qubits"] = _ep_exact(artifact["num_qubits"], "qiskit.transpile", tool_version)
        if artifact.get("depth") is not None:
            metrics["depth"] = _ep_exact(artifact["depth"], "qiskit.transpile", tool_version)
        ops = artifact.get("operation_counts") or {}
        cx = ops.get("cx") or ops.get("cz") or 0
        metrics["cx_count"] = _ep_exact(cx, "qiskit.transpile", tool_version)

    if target.get("execution_class") == "hardware" and artifact and artifact.get("num_qubits") is not None:
        cap = target.get("qubit_count")
        if cap is not None and artifact["num_qubits"] > cap:
            violations.append(
                {
                    "code": "qubit_width_exceeded",
                    "detail": f"Circuit width {artifact['num_qubits']} exceeds backend {cap}",
                }
            )
        bg = target.get("basis_gates") or []
        if bg:
            unknown = [g for g in (artifact.get("operation_counts") or {}) if g not in bg and g not in ("barrier", "measure")]
            if unknown:
                violations.append(
                    {"code": "basis_gate_mismatch", "detail": f"Ops not in backend basis: {unknown[:8]}"}
                )

    report_status = "failed" if violations or status == "failed" else "passed"
    if target["execution_class"] != "hardware":
        # Sim path never claims hardware execution
        metrics["hardware_dispatch"] = _ep_exact(False, "preflight.policy")

    rid = str(uuid.uuid4())
    report = PreflightReportModel(
        report_id=rid,
        project_id=project_id,
        circuit_id=circuit_id,
        execution_target_id=execution_target_id,
        status=report_status,
        violations_json=violations,
        metrics_json=metrics,
        execution_class=target["execution_class"],
        created_by=created_by,
        completed_at=_utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_execution_targets(db: Session) -> List[Dict[str, Any]]:
    targets: List[Dict[str, Any]] = [
        {"id": "simulator_local", "execution_class": "simulated", "label": "Local CPU simulator", "backend_type": "simulator"},
        {"id": "simulator_gpu", "execution_class": "simulated", "label": "GPU simulator (connector)", "backend_type": "simulator"},
    ]
    for b in db.query(BackendModel).order_by(BackendModel.backend_name).limit(200).all():
        cls = "hardware" if (b.backend_type or "").lower() == "hardware" else "simulated"
        targets.append(
            {
                "id": f"backend:{b.backend_id}",
                "execution_class": cls,
                "label": b.backend_name,
                "backend_type": b.backend_type,
                "qubit_count": b.qubit_count,
                "operational_status": b.operational_status,
            }
        )
    return targets
