from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.connectors.compile_qiskit import compile_circuit
from app.models.development import CircuitVersionModel, CompilationRunModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def run_compilation(
    db: Session,
    *,
    circuit: CircuitVersionModel,
    created_by: str,
    transpile_config: Optional[Dict[str, Any]] = None,
) -> CompilationRunModel:
    cfg = transpile_config or {}
    status, diagnostics, artifact, tool, tool_version = compile_circuit(
        circuit.source_text or "",
        circuit.source_language,
        optimization_level=int(cfg.get("optimization_level", 1)),
        basis_gates=cfg.get("basis_gates"),
    )
    run_id = str(uuid.uuid4())
    run = CompilationRunModel(
        run_id=run_id,
        project_id=circuit.project_id,
        circuit_id=circuit.circuit_id,
        status=status,
        transpile_config_json=cfg,
        diagnostics_json=diagnostics,
        compiled_artifact_json=artifact,
        tool=tool,
        tool_version=tool_version,
        created_by=created_by,
        completed_at=_utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
