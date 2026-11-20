"""Shared queue wait coercion for API responses."""
from __future__ import annotations

from typing import Optional


def resolve_estimated_wait(pending: Optional[int], wait: Optional[float]) -> Optional[float]:
    """
    Treat 0s wait as unknown when jobs are pending (IBM often reports queue depth only).
    When queue is empty, 0s is a valid explicit value.
    When pending is None (e.g. Rigetti), depth is unknown — wait stays unknown unless vendor sent one.
    """
    if pending is None:
        if wait is None:
            return None
        w = float(wait)
        return w if w > 0 else None
    p = int(pending)
    if p <= 0:
        if wait is not None and wait <= 0:
            return 0.0
        return None if wait is None else float(wait)
    if wait is None or wait <= 0:
        return None
    return float(wait)