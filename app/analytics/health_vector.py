"""SRS 4-D health vector H = [F_limit, η_cal, δ_cal, C_exec] and GREEN/YELLOW/RED router.

Missing inputs → UNKNOWN (never GREEN). Units: T1/T2/t_gate in microseconds.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

T_GATE_US = 0.05  # 50 ns reference 1Q pulse
T1_CRIT_US = 40.0
ETA_GREEN = 1.2
ETA_YELLOW = 1.5
DELTA_TH = 2.0
C_EXEC_MIN = 0.5
REF_CIRCUIT = {"n1q": 10, "n2q": 5, "n_meas": 10, "depth": 20}
HEALTH_MODEL_VERSION = "2.0.0-advisory"
MIN_T1_SAMPLES_FOR_DELTA = 3


def _pos(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v) or v <= 0:
        return None
    return v


def fidelity_limit(t1_us: Optional[float], t2_us: Optional[float], t_gate_us: float = T_GATE_US) -> Optional[float]:
    t1, t2 = _pos(t1_us), _pos(t2_us)
    tg = _pos(t_gate_us)
    if t1 is None or t2 is None or tg is None:
        return None
    fl = 1.0 - (tg / (3.0 * t1) + tg / (3.0 * t2))
    return max(0.0, min(1.0, fl))


def eta_cal(f_gate: Optional[float], f_limit: Optional[float]) -> Optional[float]:
    if f_gate is None or f_limit is None:
        return None
    try:
        fg, fl = float(f_gate), float(f_limit)
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(fg) and math.isfinite(fl)):
        return None
    denom = 1.0 - fl
    if denom <= 1e-15:
        return 0.0 if fg >= fl else float("inf")
    return (1.0 - fg) / denom


def delta_cal(
    t1: Optional[float],
    t1_base: Optional[float],
    sigma_t1: Optional[float],
    f_gate: Optional[float] = None,
    f_base: Optional[float] = None,
    sigma_g: Optional[float] = None,
) -> Optional[float]:
    parts: List[float] = []
    if t1 is not None and t1_base is not None and sigma_t1 is not None and sigma_t1 > 0:
        parts.append(abs(float(t1) - float(t1_base)) / float(sigma_t1))
    if f_gate is not None and f_base is not None and sigma_g is not None and sigma_g > 0:
        parts.append(abs(float(f_gate) - float(f_base)) / float(sigma_g))
    if not parts:
        return None
    return sum(parts)


def c_exec(
    f1q: Optional[float],
    n1q: int,
    f2q: Optional[float],
    n2q: int,
    pread: Optional[float],
    n_meas: int,
    depth: int,
    t_gate_us: float,
    t1_us: Optional[float],
) -> Optional[float]:
    t1 = _pos(t1_us)
    tg = _pos(t_gate_us)
    if f1q is None or f2q is None or pread is None or t1 is None or tg is None:
        return None
    try:
        p = float(pread)
        a, b = float(f1q), float(f2q)
    except (TypeError, ValueError):
        return None
    if min(a, b, 1.0 - p) < 0:
        return None
    deco = math.exp(-float(depth) * tg / t1)
    return (a ** n1q) * (b ** n2q) * ((1.0 - p) ** n_meas) * deco


def assess_confidence(
    *,
    t1: Optional[float],
    eta: Optional[float],
    delta: Optional[float],
    c_value: Optional[float],
    t1_history_points: int = 0,
) -> Dict[str, Any]:
    """Deterministic confidence — not a validated scientific calibration."""
    missing: List[str] = []
    if t1 is None:
        return {"confidence": "none", "missing_components": ["T1"], "delta_cal_status": "unavailable"}
    if eta is None:
        missing.append("eta_cal")
    if c_value is None:
        missing.append("C_exec")
    if delta is None:
        if t1_history_points < MIN_T1_SAMPLES_FOR_DELTA:
            missing.append("delta_cal_insufficient_history")
            delta_status = "insufficient_history"
        else:
            missing.append("delta_cal")
            delta_status = "unavailable"
    else:
        delta_status = "computed"
    if not missing:
        return {"confidence": "high", "missing_components": [], "delta_cal_status": delta_status}
    if missing == ["delta_cal_insufficient_history"]:
        return {
            "confidence": "limited",
            "missing_components": [f"δ_cal needs ≥{MIN_T1_SAMPLES_FOR_DELTA} T1 samples ({t1_history_points} stored)"],
            "delta_cal_status": delta_status,
        }
    return {"confidence": "limited", "missing_components": missing, "delta_cal_status": delta_status}


def route(
    t1: Optional[float],
    t1_crit: float,
    eta: Optional[float],
    delta: Optional[float],
    c_value: Optional[float],
    env_severity: Optional[str] = None,
) -> Dict[str, Any]:
    reasons: List[str] = []
    env = (env_severity or "").upper()
    if t1 is None:
        return {
            "state": "UNKNOWN",
            "action": "HOLD",
            "reasons": ["T1 missing — refuse GREEN"],
        }
    if t1 < t1_crit:
        reasons.append(f"T1 {t1:.1f} µs < T1_crit {t1_crit:.1f} µs")
        return {
            "state": "RED",
            "action": "ADVISORY_QUARANTINE",
            "action_scope": "advisory",
            "reasons": reasons,
        }
    if env == "CRITICAL":
        reasons.append("environment CRITICAL")
        return {
            "state": "RED",
            "action": "ADVISORY_QUARANTINE",
            "action_scope": "advisory",
            "reasons": reasons,
        }
    if eta is not None and eta > ETA_YELLOW:
        reasons.append(f"η_cal {eta:.2f} > {ETA_YELLOW}")
        return {"state": "YELLOW", "action": "RECALIBRATE", "reasons": reasons}
    if delta is not None and delta > DELTA_TH:
        reasons.append(f"δ_cal {delta:.2f} > {DELTA_TH}")
        return {"state": "YELLOW", "action": "RECALIBRATE", "reasons": reasons}
    if (
        c_value is not None
        and c_value >= C_EXEC_MIN
        and (eta is None or eta <= ETA_GREEN)
        and (delta is None or delta <= DELTA_TH)
        and eta is not None
    ):
        return {
            "state": "GREEN",
            "action": "ALLOW",
            "reasons": [f"C_exec {c_value:.3f} ≥ {C_EXEC_MIN}, η_cal ≤ {ETA_GREEN}"],
        }
    if eta is None or c_value is None:
        return {
            "state": "UNKNOWN",
            "action": "HOLD",
            "reasons": ["η_cal or C_exec missing — refuse GREEN"],
        }
    reasons.append("below GREEN gate")
    return {"state": "YELLOW", "action": "THROTTLE", "reasons": reasons}


def evaluate_qubit(
    t1: Optional[float],
    t2: Optional[float],
    readout_error: Optional[float],
    gate_error_1q: Optional[float],
    gate_error_2q: Optional[float],
    t_gate_us: float,
    t1_crit: float,
    t1_base: Optional[float] = None,
    sigma_t1: Optional[float] = None,
    env_severity: Optional[str] = None,
    circuit: Optional[Dict[str, int]] = None,
    t1_history_points: int = 0,
) -> Dict[str, Any]:
    circ = circuit or REF_CIRCUIT
    f_limit = fidelity_limit(t1, t2, t_gate_us)
    f1q = (1.0 - float(gate_error_1q)) if gate_error_1q is not None else None
    f2q = (1.0 - float(gate_error_2q)) if gate_error_2q is not None else None
    eta = eta_cal(f1q, f_limit)
    delta = delta_cal(t1, t1_base, sigma_t1)
    c_value = c_exec(
        f1q, circ["n1q"], f2q, circ["n2q"], readout_error,
        circ["n_meas"], circ["depth"], t_gate_us, t1,
    )
    decision = route(t1, t1_crit, eta, delta, c_value, env_severity)
    meta = assess_confidence(
        t1=t1,
        eta=eta,
        delta=delta,
        c_value=c_value,
        t1_history_points=t1_history_points,
    )
    return {
        "F_limit": f_limit,
        "eta_cal": eta,
        "delta_cal": delta,
        "C_exec": c_value,
        "F_1q": f1q,
        "F_2q": f2q,
        "health_model_version": HEALTH_MODEL_VERSION,
        **meta,
        **decision,
    }


def mean_or_none(vals: List[Optional[float]]) -> Optional[float]:
    nums = [float(v) for v in vals if v is not None and math.isfinite(float(v))]
    if not nums:
        return None
    return sum(nums) / len(nums)


if __name__ == "__main__":
    # Known numeric check against SRS formula.
    fl = fidelity_limit(200.0, 150.0, 0.05)
    assert fl is not None and abs(fl - 0.999805555) < 1e-8, fl
    red = route(31.8, 40.0, 1.0, 0.1, 0.9)
    assert red["state"] == "RED" and red["action"] == "ADVISORY_QUARANTINE"
    unk = route(None, 40.0, 1.0, 0.1, 0.9)
    assert unk["state"] == "UNKNOWN"
    print("health_vector self-check ok")
