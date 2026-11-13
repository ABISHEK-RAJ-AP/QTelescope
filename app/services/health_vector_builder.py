"""Bounded DB reads for /health/vector (no full-table scan)."""
from __future__ import annotations

import statistics
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.health_vector import (
    HEALTH_MODEL_VERSION,
    T_GATE_US,
    T1_CRIT_US,
    evaluate_qubit,
    mean_or_none,
)
from app.api.environment import env_severity_for
from app.models.entities import (
    AlertRuleModel,
    BackendModel,
    GateTelemetryModel,
    QubitModel,
    QubitTelemetryModel,
)
from datetime import timedelta


def _t1_crit(db: Session) -> float:
    rule = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == "rule_t1").first()
    if rule and rule.threshold_value:
        return float(rule.threshold_value)
    return T1_CRIT_US


def _latest_gates(db: Session, backend_id: str):
    latest_ts = (
        db.query(func.max(GateTelemetryModel.timestamp))
        .filter(GateTelemetryModel.backend_id == backend_id)
        .scalar()
    )
    if not latest_ts:
        return [], []
    cutoff = latest_ts - timedelta(minutes=2)
    rows = (
        db.query(GateTelemetryModel)
        .filter(GateTelemetryModel.backend_id == backend_id, GateTelemetryModel.timestamp >= cutoff)
        .all()
    )
    g1, g2 = [], []
    for g in rows:
        if g.gate_error is None:
            continue
        nq = len(g.qubits or [])
        if nq <= 1:
            g1.append(g)
        else:
            g2.append(g)
    return g1, g2


def _gate_error_for(gates, qubit_index: int, fallback):
    for g in gates:
        if qubit_index in (g.qubits or []):
            return g.gate_error
    return fallback


def _t_gate_us(gates) -> float:
    durs = [g.gate_duration for g in gates if g.gate_duration]
    if not durs:
        return T_GATE_US
    mean_ns = sum(durs) / len(durs)
    if mean_ns > 1.0:
        return mean_ns / 1000.0
    return mean_ns


def _history_by_qubit(db: Session, backend_id: str, n_qubits: int, per_qubit: int = 24):
    """Recent rows only — enough for per-qubit sigma (not full telemetry table)."""
    cap = max(500, min(n_qubits * (per_qubit + 2), 20000))
    hist_rows = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == backend_id)
        .order_by(QubitTelemetryModel.timestamp.desc())
        .limit(cap)
        .all()
    )
    by_idx: dict[int, list] = {}
    for row in hist_rows:
        lst = by_idx.setdefault(row.qubit_index, [])
        if len(lst) < per_qubit:
            lst.append(row)
    return by_idx


def build_health_vector_payload(db: Session) -> dict:
    t1_crit = _t1_crit(db)
    backends = db.query(BackendModel).all()
    out = []
    for b in backends:
        env_sev = env_severity_for(b.backend_id)
        g1, g2 = _latest_gates(db, b.backend_id)
        fallback_1q = mean_or_none([g.gate_error for g in g1])
        fallback_2q = mean_or_none([g.gate_error for g in g2])
        t_gate = _t_gate_us(g1 or g2)
        qubits = db.query(QubitModel).filter(QubitModel.backend_id == b.backend_id).all()
        by_idx = _history_by_qubit(db, b.backend_id, len(qubits) or 1)
        q_rows = []
        for q in qubits:
            series = by_idx.get(q.qubit_index) or []
            qt = series[0] if series else None
            t1 = qt.t1 if qt else None
            t2 = qt.t2 if qt else None
            ro = qt.readout_error if qt else None
            t1s = [h.t1 for h in series[:24] if h.t1 is not None]
            t1_base = sigma = None
            history_n = len(t1s)
            if history_n >= 3:
                t1_base = statistics.fmean(t1s)
                stdev = statistics.pstdev(t1s)
                sigma = stdev if stdev > 0 else None
            vec = evaluate_qubit(
                t1=t1,
                t2=t2,
                readout_error=ro,
                gate_error_1q=_gate_error_for(g1, q.qubit_index, fallback_1q),
                gate_error_2q=_gate_error_for(g2, q.qubit_index, fallback_2q),
                t_gate_us=t_gate,
                t1_crit=t1_crit,
                t1_base=t1_base,
                sigma_t1=sigma,
                env_severity=env_sev,
                t1_history_points=history_n,
            )
            q_rows.append(
                {
                    "qubit_index": q.qubit_index,
                    "status": q.status,
                    "t1": t1,
                    "t2": t2,
                    "readout_error": ro,
                    **vec,
                }
            )
        counts = {k: 0 for k in ("GREEN", "YELLOW", "RED", "UNKNOWN")}
        for row in q_rows:
            counts[row["state"]] = counts.get(row["state"], 0) + 1
        backend_state = "UNKNOWN"
        if counts["RED"]:
            backend_state = "RED"
        elif counts["YELLOW"]:
            backend_state = "YELLOW"
        elif counts["GREEN"] and not counts["UNKNOWN"]:
            backend_state = "GREEN"
        elif counts["GREEN"]:
            backend_state = "YELLOW"
        action = {
            "RED": "ADVISORY_QUARANTINE",
            "YELLOW": "RECALIBRATE",
            "GREEN": "ALLOW",
        }.get(backend_state, "HOLD")
        confidences = [r.get("confidence") for r in q_rows]
        backend_confidence = (
            "none"
            if "none" in confidences
            else ("limited" if "limited" in confidences else "high")
        )
        out.append(
            {
                "backend_id": b.backend_id,
                "backend_name": b.backend_name,
                "qpu_modality": b.qpu_modality,
                "operational_status": b.operational_status,
                "router": backend_state,
                "recommended_action": action,
                "action_scope": "advisory",
                "confidence": backend_confidence,
                "env_severity": env_sev,
                "t_gate_us": t_gate,
                "t1_crit_us": t1_crit,
                "counts": counts,
                "vector": {
                    "F_limit": mean_or_none([r["F_limit"] for r in q_rows]),
                    "eta_cal": mean_or_none([r["eta_cal"] for r in q_rows]),
                    "delta_cal": mean_or_none([r["delta_cal"] for r in q_rows]),
                    "C_exec": mean_or_none([r["C_exec"] for r in q_rows]),
                },
                "qubits": q_rows,
            }
        )
    return {
        "health_model_version": HEALTH_MODEL_VERSION,
        "disclaimer": "Advisory readiness only — not vendor calibration or scheduler exclusion.",
        "t_gate_us": T_GATE_US,
        "t1_crit_us": t1_crit,
        "backends": out,
    }


_ROUTER_OVERALL = {
    "GREEN": "HEALTHY",
    "YELLOW": "DEGRADED",
    "RED": "CRITICAL",
    "UNKNOWN": "UNKNOWN",
}
_STATE_LABEL = {
    "GREEN": "Healthy",
    "YELLOW": "Warning",
    "RED": "Degraded",
    "UNKNOWN": "Unknown",
}
_ROUTER_SCORE = {"GREEN": 100.0, "YELLOW": 70.0, "RED": 40.0, "UNKNOWN": 0.0}
_FACTOR_STATUS = {
    "GREEN": "HEALTHY",
    "YELLOW": "WARNING",
    "RED": "CRITICAL",
    "UNKNOWN": "UNKNOWN",
}


def cached_health_vector(db: Session) -> dict:
    from app.core.cache import cache_key, default_ttl, get_or_set_json

    ttl = default_ttl("health_vector", 10)
    return get_or_set_json(cache_key("health", "vector"), ttl, lambda: build_health_vector_payload(db))


def backend_by_id(payload: dict) -> dict:
    return {row["backend_id"]: row for row in payload.get("backends") or []}


def qubit_state(row: dict, qubit_index: int) -> str:
    for q in row.get("qubits") or []:
        if q.get("qubit_index") == qubit_index:
            return q.get("state") or "UNKNOWN"
    return "UNKNOWN"


def health_label(state: str) -> str:
    return _STATE_LABEL.get(state or "UNKNOWN", "Unknown")


def legacy_backend_card(row: dict) -> dict:
    router = row.get("router") or "UNKNOWN"
    counts = row.get("counts") or {}
    return {
        "overall_health": _ROUTER_OVERALL.get(router, "UNKNOWN"),
        "health_score": _ROUTER_SCORE.get(router, 0.0),
        "contributing_factors": [
            {
                "name": "Health vector",
                "status": _FACTOR_STATUS.get(router, "UNKNOWN"),
                "description": (
                    f"{counts.get('RED', 0)} red, {counts.get('YELLOW', 0)} yellow, "
                    f"{counts.get('GREEN', 0)} green, {counts.get('UNKNOWN', 0)} unknown"
                ),
                "value": router,
            }
        ],
    }
