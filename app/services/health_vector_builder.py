"""Bounded DB reads for /health/vector (no full-table scan)."""
from __future__ import annotations

import statistics
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.health_vector import (
    C_EXEC_MIN,
    DELTA_TH,
    ETA_GREEN,
    ETA_YELLOW,
    HEALTH_MODEL_VERSION,
    T_GATE_US,
    evaluate_qubit,
    mean_or_none,
)
from app.alerts.rule_eval import load_rules, rule_threshold
from app.alerts.rule_eval import _coherence_rule_usable
from app.analytics.modality_thresholds import (
    resolve_coherence_modality,
    modality_profile,
    threshold_summary,
)
from app.api.environment import env_severity_for
from app.core.provenance import resolve_backend_data_lineage
from app.models.entities import (
    BackendModel,
    BackendTelemetryModel,
    GateTelemetryModel,
    QubitModel,
    QubitTelemetryModel,
)
from datetime import timedelta


def _t1_crit_for_backend(
    db: Session, backend_id: str, modality: str | None, backend_type: str | None = None
) -> float:
    mod = resolve_coherence_modality(modality, backend_type)
    rules = load_rules(db, backend_id)
    floor = float(modality_profile(mod)["t1_crit_us"])
    raw = rule_threshold(rules, "T1", floor)
    return _coherence_rule_usable(mod, "T1", raw, floor)


def _t2_crit_for_backend(
    db: Session, backend_id: str, modality: str | None, backend_type: str | None = None
) -> float:
    mod = resolve_coherence_modality(modality, backend_type)
    rules = load_rules(db, backend_id)
    floor = float(modality_profile(mod)["t2_crit_us"])
    raw = rule_threshold(rules, "T2", floor)
    return _coherence_rule_usable(mod, "T2", raw, floor)


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


def _resolve_2q_error(g2, qubit_index: int, fallback_1q, fallback_2q):
    """Use backend 1Q mean as conservative 2Q proxy when the feed omits 2Q fidelity."""
    g2e = _gate_error_for(g2, qubit_index, fallback_2q)
    if g2e is not None:
        return g2e, []
    if fallback_2q is not None:
        return fallback_2q, []
    if fallback_1q is not None:
        return fallback_1q, ["2Q gate fidelity not in feed; using backend 1Q mean as conservative proxy"]
    return None, ["2Q gate fidelity missing — C_exec and η_cal may be unavailable"]


def _router_explanation(backend_state: str, counts: dict, env_sev: str, q_rows: list) -> str:
    parts: list[str] = []
    env = (env_sev or "").upper()
    if env == "CRITICAL":
        parts.append("environment CRITICAL")
    n_red = int(counts.get("RED") or 0)
    n_yellow = int(counts.get("YELLOW") or 0)
    if backend_state == "RED" and n_red:
        parts.append(f"{n_red} qubit(s) RED — worst qubit wins for backend routing")
        tallies: dict[str, int] = {}
        for q in q_rows:
            if q.get("state") != "RED":
                continue
            for reason in q.get("reasons") or []:
                tallies[reason] = tallies.get(reason, 0) + 1
        for reason, n in sorted(tallies.items(), key=lambda x: (-x[1], x[0]))[:2]:
            parts.append(f"{reason} ({n}×)")
    elif backend_state == "YELLOW" and n_yellow:
        parts.append(f"{n_yellow} qubit(s) YELLOW — worst qubit wins")
    elif backend_state == "GREEN":
        parts.append("all qubits pass GREEN gates")
    elif backend_state == "UNKNOWN":
        parts.append("insufficient metrics for GREEN (see per-qubit UNKNOWN)")
    return "; ".join(parts)


def _latest_telemetry_sources(db: Session, backend_ids: list[str]) -> dict[str, str | None]:
    """Most recent backend_telemetry.telemetry_source per backend (ingest lineage)."""
    if not backend_ids:
        return {}
    out: dict[str, str | None] = {bid: None for bid in backend_ids}
    rows = (
        db.query(BackendTelemetryModel)
        .filter(BackendTelemetryModel.backend_id.in_(backend_ids))
        .order_by(BackendTelemetryModel.backend_id, BackendTelemetryModel.timestamp.desc())
        .all()
    )
    for row in rows:
        if out.get(row.backend_id) is None:
            out[row.backend_id] = row.telemetry_source
    return out


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
    from app.alerts.rule_backend import ensure_backend_rules

    backends = db.query(BackendModel).all()
    telemetry_src = _latest_telemetry_sources(db, [b.backend_id for b in backends])
    out = []
    for b in backends:
        ensure_backend_rules(db, b.backend_id)
        health_mod = resolve_coherence_modality(b.qpu_modality, b.backend_type)
        t1_crit = _t1_crit_for_backend(db, b.backend_id, b.qpu_modality, b.backend_type)
        t2_crit = _t2_crit_for_backend(db, b.backend_id, b.qpu_modality, b.backend_type)
        thresh = threshold_summary(health_mod)
        thresh["t1_crit_us"] = t1_crit
        thresh["t2_crit_us"] = t2_crit
        thresh["scope"] = "backend_alert_rules"
        env_sev = env_severity_for(b.backend_id)
        g1, g2 = _latest_gates(db, b.backend_id)
        fallback_1q = mean_or_none([g.gate_error for g in g1])
        fallback_2q = mean_or_none([g.gate_error for g in g2])
        t_gate = _t_gate_us(g1 or g2)
        qubits = db.query(QubitModel).filter(QubitModel.backend_id == b.backend_id).all()
        by_idx = _history_by_qubit(db, b.backend_id, len(qubits) or 1)
        q_rows = []
        metric_gaps: set[str] = set()
        for q in qubits:
            series = by_idx.get(q.qubit_index) or []
            qt = series[0] if series else None
            if qt:
                from app.core.metric_bounds import clamp_positive_time_us, clamp_probability
                t1 = clamp_positive_time_us(qt.t1) if qt.t1 is not None else None
                t2 = clamp_positive_time_us(qt.t2) if qt.t2 is not None else None
                ro = clamp_probability(qt.readout_error) if qt.readout_error is not None else None
            else:
                t1 = t2 = ro = None
            t1s = [h.t1 for h in series[:24] if h.t1 is not None]
            t1_base = sigma = None
            history_n = len(t1s)
            if history_n >= 3:
                t1_base = statistics.fmean(t1s)
                stdev = statistics.pstdev(t1s)
                sigma = stdev if stdev > 0 else None
            ge1 = _gate_error_for(g1, q.qubit_index, fallback_1q)
            ge2, gap_notes = _resolve_2q_error(g2, q.qubit_index, fallback_1q, fallback_2q)
            for note in gap_notes:
                metric_gaps.add(note)
            vec = evaluate_qubit(
                t1=t1,
                t2=t2,
                readout_error=ro,
                gate_error_1q=ge1,
                gate_error_2q=ge2,
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
        lineage = resolve_backend_data_lineage(
            backend_id=b.backend_id,
            provider_id=b.provider_id,
            latest_telemetry_source=telemetry_src.get(b.backend_id),
        )
        if not fallback_2q and not g2 and metric_gaps:
            if b.provider_id == "rigetti_quantum":
                metric_gaps.add("2Q gate data not supplied by the Rigetti QCS ISA feed")
        out.append(
            {
                "backend_id": b.backend_id,
                "backend_name": b.backend_name,
                "qpu_modality": b.qpu_modality,
                "operational_status": b.operational_status,
                "provider_id": b.provider_id,
                "router": backend_state,
                "router_reason": _router_explanation(backend_state, counts, env_sev, q_rows),
                "recommended_action": action,
                "action_scope": "advisory",
                "confidence": backend_confidence,
                "env_severity": env_sev,
                "t_gate_us": t_gate,
                "t1_crit_us": t1_crit,
                "t2_crit_us": t2_crit,
                "threshold_profile": thresh,
                "data_lineage": lineage["lineage"],
                "data_source_label": lineage["label"],
                "metric_gaps": sorted(metric_gaps),
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
        "routing_gates": {
            "eta_green_max": ETA_GREEN,
            "eta_yellow_max": ETA_YELLOW,
            "c_exec_min": C_EXEC_MIN,
            "delta_cal_yellow_min": DELTA_TH,
        },
        "t1_crit_note": "T1/T2 router floors come from each backend's alert-rule set (modality defaults if unset).",
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
