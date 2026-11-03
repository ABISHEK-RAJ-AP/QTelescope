from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.connectors.compile_qiskit import compile_circuit
from app.schemas.epistemic import EpistemicValue


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ep(
    value: Any,
    kind: str,
    method: str,
    tool_version: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    vk = kind if kind in ("exact", "calculated", "estimated", "backend_reported", "unavailable") else "exact"
    return EpistemicValue(
        value=value,
        value_kind=vk,  # type: ignore[arg-type]
        method=method,
        tool_version=tool_version,
        computed_at=_utcnow(),
        notes=notes,
    ).model_dump(mode="json")


def estimate_resources(
    source_text: str,
    source_language: str,
    *,
    execution_target_id: str,
    shots: int = 1024,
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    options = options or {}
    status, diagnostics, artifact, tool, tool_version = compile_circuit(
        source_text,
        source_language,
        optimization_level=int(options.get("optimization_level", 1)),
    )
    metrics: Dict[str, Any] = {
        "execution_target_id": _ep(execution_target_id, "exact", "request.input"),
        "compile_status": _ep(status, "exact", "qiskit.compile" if tool == "qiskit" else "compile.adapter"),
    }
    if artifact and artifact.get("num_qubits") is not None:
        metrics["logical_qubits"] = _ep(artifact["num_qubits"], "exact", "qiskit.transpile", tool_version)
        depth = artifact.get("depth")
        metrics["circuit_depth"] = _ep(depth, "exact" if depth is not None else "unavailable", "qiskit.transpile", tool_version)
        size = artifact.get("size")
        metrics["gate_count"] = _ep(size, "exact" if size is not None else "unavailable", "qiskit.transpile", tool_version)
        cx = (artifact.get("operation_counts") or {}).get("cx", 0)
        metrics["two_qubit_gates"] = _ep(cx, "exact", "qiskit.transpile", tool_version)
        # ponytail: naive shot cost model — replace with backend calibration weighted estimate
        est_runtime_sec = max(0.001, (artifact.get("depth") or 1) * shots * 1e-6)
        metrics["estimated_sim_runtime_sec"] = _ep(round(est_runtime_sec, 4), "estimated", "heuristic.depth_x_shots")
        metrics["requested_shots"] = _ep(shots, "exact", "request.input")
    else:
        metrics["logical_qubits"] = _ep(None, "unavailable", "qiskit.transpile", notes="Compile produced no width")
        metrics["circuit_depth"] = _ep(None, "unavailable", "qiskit.transpile")
        metrics["requested_shots"] = _ep(shots, "exact", "request.input")

    feasible = status == "completed" and not any(d.get("severity") == "error" for d in diagnostics)
    return {
        "feasible": feasible,
        "execution_class": "simulated" if execution_target_id.startswith("simulator") else "target_dependent",
        "diagnostics": diagnostics,
        "metrics": metrics,
    }
