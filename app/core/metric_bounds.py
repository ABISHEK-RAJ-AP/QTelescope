"""Physical bounds for telemetry metrics (probabilities, rates)."""
from __future__ import annotations

from typing import Optional


def clamp_probability(value: Optional[float]) -> Optional[float]:
    """Readout / gate assignment error must live in [0, 1]."""
    if value is None:
        return None
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    if x != x:  # NaN
        return None
    return max(0.0, min(1.0, x))