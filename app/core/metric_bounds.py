"""Physical bounds for telemetry metrics (probabilities, rates, coherence times)."""
from __future__ import annotations

from typing import Optional


def _finite(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    if x != x:  # NaN
        return None
    return x


def clamp_probability(value: Optional[float]) -> Optional[float]:
    """Readout misassignment, gate error rate, SPAM probs — in [0, 1]."""
    x = _finite(value)
    if x is None:
        return None
    return max(0.0, min(1.0, x))


clamp_error_rate = clamp_probability


def clamp_positive_time_us(value: Optional[float], *, floor_us: float = 0.01) -> Optional[float]:
    """T1/T2 and positive durations in microseconds."""
    x = _finite(value)
    if x is None:
        return None
    return max(floor_us, x)


def had_invalid_range(raw: object, clamped: Optional[float]) -> bool:
    r = _finite(raw)
    if r is None or clamped is None:
        return False
    return r != clamped