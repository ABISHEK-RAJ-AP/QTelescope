"""Explainable health — factor narratives from health vector v2 outputs."""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional

from app.analytics.health_vector import (
    C_EXEC_MIN,
    DELTA_TH,
    ETA_GREEN,
    ETA_YELLOW,
    T1_CRIT_US,
)


def _component_notes(vec: Dict[str, Any], *, t1_crit: float) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    t1 = vec.get("t1")
    if t1 is None:
        rows.append({"id": "t1", "label": "T1", "status": "MISSING", "note": "No T1 sample — router cannot go GREEN."})
    else:
        st = "OK" if float(t1) >= t1_crit else "BREACH"
        rows.append(
            {
                "id": "t1",
                "label": "T1 coherence",
                "status": st,
                "value": t1,
                "unit": "µs",
                "note": f"Threshold T1_crit = {t1_crit} µs",
            }
        )

    fl = vec.get("F_limit")
    rows.append(
        {
            "id": "F_limit",
            "label": "F_limit",
            "status": "OK" if fl is not None else "MISSING",
            "value": fl,
            "note": "From T1/T2/t_gate fidelity limit formula",
        }
    )

    eta = vec.get("eta_cal")
    if eta is None:
        rows.append({"id": "eta_cal", "label": "η_cal", "status": "MISSING", "note": "Needs gate error + F_limit"})
    else:
        st = "OK" if eta <= ETA_GREEN else ("WARN" if eta <= ETA_YELLOW else "BREACH")
        rows.append(
            {
                "id": "eta_cal",
                "label": "η_cal",
                "status": st,
                "value": eta,
                "note": f"GREEN if ≤ {ETA_GREEN}, YELLOW if > {ETA_YELLOW}",
            }
        )

    delta = vec.get("delta_cal")
    d_status = vec.get("delta_cal_status")
    if delta is None:
        note = (
            vec.get("missing_components") or ["δ_cal unavailable"]
        )[0] if d_status == "insufficient_history" else "δ_cal not computed"
        if d_status == "insufficient_history":
            note = "δ_cal needs more T1 history (see missing_components)"
        rows.append({"id": "delta_cal", "label": "δ_cal", "status": "MISSING", "note": note})
    else:
        st = "OK" if delta <= DELTA_TH else "BREACH"
        rows.append(
            {
                "id": "delta_cal",
                "label": "δ_cal drift",
                "status": st,
                "value": delta,
                "note": f"RECALIBRATE hint if > {DELTA_TH}",
            }
        )

    cex = vec.get("C_exec")
    if cex is None:
        rows.append({"id": "C_exec", "label": "C_exec", "status": "MISSING", "note": "Needs gate/readout + reference circuit"})
    else:
        st = "OK" if cex >= C_EXEC_MIN else "WARN"
        rows.append(
            {
                "id": "C_exec",
                "label": "C_exec",
                "status": st,
                "value": cex,
                "note": f"GREEN path needs C_exec ≥ {C_EXEC_MIN}",
            }
        )

    conf = vec.get("confidence") or "none"
    rows.append(
        {
            "id": "confidence",
            "label": "Confidence",
            "status": "OK" if conf == "high" else "LIMITED",
            "value": conf,
            "note": "; ".join(vec.get("missing_components") or []) or "All components present",
        }
    )
    return rows


def explain_qubit(vec: Dict[str, Any], *, t1_crit: float = T1_CRIT_US) -> Dict[str, Any]:
    reasons = list(vec.get("reasons") or [])
    return {
        "qubit_index": vec.get("qubit_index"),
        "router_state": vec.get("state"),
        "recommended_action": vec.get("action"),
        "action_scope": vec.get("action_scope", "advisory"),
        "summary": reasons[0] if reasons else f"Router {vec.get('state')} with no explicit rule hit.",
        "reasons": reasons,
        "components": _component_notes(vec, t1_crit=t1_crit),
        "missing_components": vec.get("missing_components") or [],
    }


def explain_backend(backend_row: Dict[str, Any], *, t1_crit: float = T1_CRIT_US) -> Dict[str, Any]:
    qubits = backend_row.get("qubits") or []
    reason_counts: Counter = Counter()
    for q in qubits:
        for r in q.get("reasons") or []:
            reason_counts[r] += 1

    dominant = [{"reason": r, "qubit_count": c} for r, c in reason_counts.most_common(5)]
    flagged = [explain_qubit(q, t1_crit=t1_crit) for q in qubits if q.get("state") != "GREEN"]

    narrative_parts = [
        f"Backend router {backend_row.get('router')} → {backend_row.get('recommended_action')} "
        f"(confidence {backend_row.get('confidence')})."
    ]
    if dominant:
        narrative_parts.append(f"Top driver: {dominant[0]['reason']} ({dominant[0]['qubit_count']} qubits).")
    else:
        narrative_parts.append("No qubit-level rule breaches on flagged set.")

    return {
        "backend_id": backend_row.get("backend_id"),
        "backend_name": backend_row.get("backend_name"),
        "router_state": backend_row.get("router"),
        "recommended_action": backend_row.get("recommended_action"),
        "confidence": backend_row.get("confidence"),
        "counts": backend_row.get("counts"),
        "vector_means": backend_row.get("vector"),
        "dominant_reasons": dominant,
        "narrative": " ".join(narrative_parts),
        "flagged_qubit_explanations": flagged[:20],
        "methodology": "Rule-based health vector v2 — not vendor calibration certification.",
    }
