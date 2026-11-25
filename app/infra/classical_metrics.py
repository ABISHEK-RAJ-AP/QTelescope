"""Classical / HPC metrics for PARAM QSim and on-prem simulator backends."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.mock_data import get_mock_backend
from app.models.entities import BackendModel

PARAM_DEFAULT_BACKEND = "cdac_qsim_param"


def _is_param_backend(backend_id: str, provider_id: Optional[str], backend_type: Optional[str]) -> bool:
    if backend_id == PARAM_DEFAULT_BACKEND or (backend_id or "").startswith("cdac"):
        return True
    if provider_id == "cdac_quantum":
        return True
    return backend_type == "simulator" and provider_id == "cdac_quantum"


def sample_classical_metrics(
    backend_id: str,
    qubit_count: int = 64,
    *,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    """Simulated PARAM Siddhi-AI style host metrics until live Slurm/Prometheus wired."""
    rng = random.Random(seed if seed is not None else hash(backend_id) & 0xFFFF)
    mock = get_mock_backend(backend_id) or get_mock_backend(PARAM_DEFAULT_BACKEND) or {}
    ext = mock.get("modality_extensions") or {}
    n = qubit_count or mock.get("qubit_count") or 64
    # Theoretical exact statevector size — not cluster RAM (grows as 2^n).
    statevector_theory_bytes = (2**n) * 16
    mem_cap = round(rng.uniform(512.0, 4096.0), 1)
    mem_used = round(mem_cap * rng.uniform(0.35, 0.72), 1)
    mpi_ranks = int(rng.choice([64, 128, 256, 512]))
    return {
        "backend_id": backend_id,
        "telemetry_source": "simulated:param_hpc",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hpc_cluster": ext.get("supercomputing_cluster", "PARAM HPC cluster"),
        "acceleration_stack": ext.get("acceleration_stack", "MPI + OpenMP + CUDA"),
        "mpi_ranks_active": mpi_ranks,
        "cpu_util_pct": round(rng.uniform(42.0, 88.0), 1),
        "memory_used_gib": mem_used,
        "memory_cap_gib": mem_cap,
        "gpu_count": int(rng.choice([4, 8, 16])),
        "gpu_util_pct": round(rng.uniform(55.0, 96.0), 1),
        "simulation_queue_depth": int(rng.randint(0, 6)),
        "statevector_theory_bytes": statevector_theory_bytes,
        "qubits_simulated": n,
        "note": "Classical host metrics — not QPU cryo readings.",
    }


def classical_infra_for_backend(
    backend_id: str,
    provider_id: Optional[str] = None,
    backend_type: Optional[str] = None,
    qubit_count: int = 64,
) -> Optional[Dict[str, Any]]:
    if not _is_param_backend(backend_id, provider_id, backend_type):
        return None
    return sample_classical_metrics(backend_id, qubit_count)


def list_classical_infra(db: Session) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for b in db.query(BackendModel).all():
        row = classical_infra_for_backend(
            b.backend_id, b.provider_id, b.backend_type, b.qubit_count or 64
        )
        if row:
            row["backend_name"] = b.backend_name
            out.append(row)
    return out
