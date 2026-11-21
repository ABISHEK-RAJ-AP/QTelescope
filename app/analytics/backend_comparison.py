"""Modality-aware backend comparison — advisory only."""
from __future__ import annotations

import math
import statistics
from typing import Any, Dict, List, Optional

from app.analytics.health_vector import C_EXEC_MIN, DELTA_TH, ETA_GREEN, ETA_YELLOW, T_GATE_US

METHODOLOGY_SHORT = (
    "Compare ranks and pair deltas only within the same modality. "
    "Cross-modality selections are side-by-side context, not a league table."
)

ROUTING_GATES = {
    "eta_green_max": ETA_GREEN,
    "eta_yellow_max": ETA_YELLOW,
    "c_exec_min": C_EXEC_MIN,
    "delta_cal_yellow_min": DELTA_TH,
    "t_gate_us": T_GATE_US,
    "t_gate_note": "Reference 50 ns when gate telemetry missing; otherwise mean 1Q duration from latest gates",
    "t1_crit_source": "per-backend alert rules (Admin → Alert rules)",
}


def routing_summary_text(gates: Dict[str, Any] | None = None) -> str:
    g = gates or ROUTING_GATES
    return (
        "Worst qubit wins. RED: T1 below that backend's alert-rule floor, environment CRITICAL, "
        f"or any qubit RED. YELLOW: η_cal > {g['eta_yellow_max']} or δ_cal > {g['delta_cal_yellow_min']}. "
        f"GREEN: η_cal ≤ {g['eta_green_max']} and C_exec ≥ {g['c_exec_min']} with metrics present."
    )


def _delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return float(a) - float(b)


def _median(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return float(statistics.median(values))


def _qubit_median(backend_row: dict, key: str) -> Optional[float]:
    vals: List[float] = []
    for q in backend_row.get("qubits") or []:
        v = q.get(key)
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if math.isfinite(f):
            vals.append(f)
    return _median(vals)


def build_comparison(
    vector_backends: List[dict],
    coherence_backends: List[dict],
    backend_ids: List[str],
) -> Dict[str, Any]:
    by_vec = {b["backend_id"]: b for b in vector_backends}
    by_coh = {b["backend_id"]: b for b in coherence_backends}
    selected_vec = []
    for bid in backend_ids:
        if bid not in by_vec:
            raise KeyError(bid)
        row = dict(by_vec[bid])
        coh = by_coh.get(bid, {})
        row["coherence"] = {
            "t1_mean": coh.get("t1_mean"),
            "t2_mean": coh.get("t2_mean"),
            "n_qubits_sampled": coh.get("n"),
        }
        selected_vec.append(row)

    modalities = {(r.get("qpu_modality") or "unknown") for r in selected_vec}
    same_modality = len(modalities) == 1

    pairs: List[dict] = []
    for i in range(len(backend_ids)):
        for j in range(i + 1, len(backend_ids)):
            a_id, b_id = backend_ids[i], backend_ids[j]
            a, b = by_vec[a_id], by_vec[b_id]
            mod_a = a.get("qpu_modality") or "unknown"
            mod_b = b.get("qpu_modality") or "unknown"
            mod_match = mod_a == mod_b
            va, vb = a.get("vector") or {}, b.get("vector") or {}
            ca, cb = by_coh.get(a_id, {}), by_coh.get(b_id, {})
            pairs.append(
                {
                    "backend_a": a_id,
                    "backend_b": b_id,
                    "same_modality": mod_match,
                    "ranking_allowed": mod_match,
                    "delta": {
                        "F_limit": _delta(_qubit_median(a, "F_limit"), _qubit_median(b, "F_limit")),
                        "eta_cal": _delta(_qubit_median(a, "eta_cal"), _qubit_median(b, "eta_cal")),
                        "delta_cal": _delta(_qubit_median(a, "delta_cal"), _qubit_median(b, "delta_cal")),
                        "C_exec": _delta(_qubit_median(a, "C_exec"), _qubit_median(b, "C_exec")),
                        "t1_median_us": _delta(
                            _qubit_median(a, "t1"),
                            _qubit_median(b, "t1"),
                        ),
                        "t2_median_us": _delta(
                            _qubit_median(a, "t2"),
                            _qubit_median(b, "t2"),
                        ),
                        "t1_mean_us": _delta(ca.get("t1_mean"), cb.get("t1_mean")),
                        "t2_mean_us": _delta(ca.get("t2_mean"), cb.get("t2_mean")),
                    },
                    "delta_basis": "qubit_medians",
                }
            )

    by_id = {r["backend_id"]: r for r in selected_vec}
    pairs_out: List[dict] = []
    for p in pairs:
        a, b = by_id.get(p["backend_a"], {}), by_id.get(p["backend_b"], {})
        pairs_out.append(
            {
                **p,
                "t1_crit_a_us": a.get("t1_crit_us"),
                "t1_crit_b_us": b.get("t1_crit_us"),
            }
        )

    return {
        "methodology": METHODOLOGY_SHORT,
        "routing_gates": ROUTING_GATES,
        "routing_summary": routing_summary_text(ROUTING_GATES),
        "same_modality_selection": same_modality,
        "modalities": sorted(modalities),
        "backend_ids": backend_ids,
        "backends": selected_vec,
        "pairs": pairs_out,
    }
