"""Modality-aware backend comparison — advisory only."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

METHODOLOGY = (
    "Rank T1/T2 and F_limit only within the same qpu_modality. "
    "Cross-modality rows are side-by-side context, not a league table. "
    "Units: microseconds for T1/T2; dimensionless for F_limit and health-vector means."
)


def _delta(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return float(a) - float(b)


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
                        "F_limit": _delta(va.get("F_limit"), vb.get("F_limit")),
                        "eta_cal": _delta(va.get("eta_cal"), vb.get("eta_cal")),
                        "delta_cal": _delta(va.get("delta_cal"), vb.get("delta_cal")),
                        "C_exec": _delta(va.get("C_exec"), vb.get("C_exec")),
                        "t1_mean_us": _delta(ca.get("t1_mean"), cb.get("t1_mean")),
                        "t2_mean_us": _delta(ca.get("t2_mean"), cb.get("t2_mean")),
                    },
                }
            )

    return {
        "methodology": METHODOLOGY,
        "same_modality_selection": same_modality,
        "modalities": sorted(modalities),
        "backend_ids": backend_ids,
        "backends": selected_vec,
        "pairs": pairs,
    }
