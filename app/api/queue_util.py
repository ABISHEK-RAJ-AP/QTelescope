"""Shared queue wait coercion for API responses."""
from __future__ import annotations

from typing import Optional


def resolve_estimated_wait(pending: int, wait: Optional[float]) -> Optional[float]:
    """
    Treat 0s wait as unknown when jobs are pending (IBM often reports queue depth only).
    When queue is empty, 0s is a valid explicit value.
    """
    p = int(pending or 0)
    if p <= 0:
        if wait is not None and wait <= 0:
            return 0.0
        return None if wait is None else float(wait)
    if wait is None or wait <= 0:
        return None
    return float(wait)