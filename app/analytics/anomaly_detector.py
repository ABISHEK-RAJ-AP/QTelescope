"""Statistical anomaly detection — EWMA + simple change-point (advisory)."""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence

EWMA_ALPHA = 0.25
Z_WARN = 2.5
Z_CRITICAL = 3.5
MIN_POINTS = 8


def _ewma_series(values: Sequence[float], alpha: float = EWMA_ALPHA) -> List[float]:
    if not values:
        return []
    out = [float(values[0])]
    for v in values[1:]:
        out.append(alpha * float(v) + (1 - alpha) * out[-1])
    return out


def _ewma_sigma(values: Sequence[float], ewma: Sequence[float]) -> List[float]:
    """ponytail: rolling RMS residual vs EWMA — O(n), not full GARCH."""
    sigs: List[float] = []
    for i, v in enumerate(values):
        if i == 0:
            sigs.append(0.0)
            continue
        window = values[: i + 1]
        mean = sum(window) / len(window)
        var = sum((float(x) - mean) ** 2 for x in window) / len(window)
        sigs.append(math.sqrt(var) if var > 0 else 0.0)
    return sigs


def _change_point_index(values: Sequence[float], min_seg: int = 4) -> Optional[int]:
    n = len(values)
    if n < MIN_POINTS:
        return None
    best_i = None
    best_score = 0.0
    for i in range(min_seg, n - min_seg):
        left = values[:i]
        right = values[i:]
        m1, m2 = sum(left) / len(left), sum(right) / len(right)
        pooled = math.sqrt(
            sum((float(x) - m1) ** 2 for x in left) / len(left)
            + sum((float(x) - m2) ** 2 for x in right) / len(right)
        )
        if pooled <= 1e-12:
            continue
        score = abs(m2 - m1) / pooled
        if score > best_score:
            best_score = score
            best_i = i
    if best_score >= 2.0:
        return best_i
    return None


def analyze_metric_series(
    series: List[Dict[str, Any]],
    metric_key: str = "t1",
) -> Dict[str, Any]:
    """series: chronological dicts with timestamp + metric_key."""
    points = [p for p in series if p.get(metric_key) is not None]
    if len(points) < 2:
        return {
            "metric": metric_key,
            "n": len(points),
            "status": "INSUFFICIENT_DATA",
            "latest_anomaly": None,
            "change_point_index": None,
            "flags": [],
        }

    values = [float(p[metric_key]) for p in points]
    ewma = _ewma_series(values)
    sigs = _ewma_sigma(values, ewma)
    flags: List[Dict[str, Any]] = []
    latest_severity = "NORMAL"

    for i, v in enumerate(values):
        sigma = sigs[i] if sigs[i] > 1e-12 else (abs(v - ewma[i]) or 1e-6)
        z = abs(v - ewma[i]) / sigma if sigma > 0 else 0.0
        sev = "NORMAL"
        reason = None
        if z >= Z_CRITICAL:
            sev = "ANOMALY"
            reason = "ewma_z_critical"
        elif z >= Z_WARN:
            sev = "WARNING"
            reason = "ewma_z_warn"
        if sev != "NORMAL":
            latest_severity = sev
            ts = points[i].get("timestamp")
            flags.append(
                {
                    "index": i,
                    "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else ts,
                    "value": v,
                    "ewma": round(ewma[i], 4),
                    "z_score": round(z, 3),
                    "severity": sev,
                    "reason": reason,
                }
            )

    cp = _change_point_index(values)
    status = latest_severity if latest_severity != "NORMAL" else "NORMAL"
    if cp is not None and status == "NORMAL":
        status = "CHANGE_POINT"

    i = len(values) - 1
    sigma = sigs[i] if sigs[i] > 1e-12 else (abs(values[i] - ewma[i]) or 1e-6)
    latest_z = round(abs(values[i] - ewma[i]) / sigma, 3) if sigma > 0 else 0.0

    return {
        "metric": metric_key,
        "n": len(values),
        "status": status,
        "latest_value": values[-1],
        "latest_ewma": round(ewma[-1], 4),
        "latest_z": latest_z,
        "change_point_index": cp,
        "change_point_timestamp": (
            points[cp].get("timestamp").isoformat()
            if cp is not None and hasattr(points[cp].get("timestamp"), "isoformat")
            else None
        ),
        "flags": flags[-10:],
        "methodology": "EWMA control chart + mean-shift change-point; advisory only.",
    }
