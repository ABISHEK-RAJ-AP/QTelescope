"""Broad write-path rate limits (admin mutations, authenticated POST storm)."""
from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import DefaultDict, List

from fastapi import HTTPException, Request

from app.core.rate_limit import _client_key, _redis_check

_WRITE_BUCKETS: DefaultDict[str, List[float]] = defaultdict(list)


def reset_write_rate_limits() -> None:
    _WRITE_BUCKETS.clear()


def _write_limits() -> tuple[int, int]:
    return (
        int(os.getenv("API_WRITE_RATE_LIMIT", "120")),
        int(os.getenv("API_WRITE_RATE_WINDOW_SEC", "60")),
    )


def check_write_rate_limit(request: Request, *, bucket: str = "api_write") -> None:
    lim, window = _write_limits()
    from app.core.cache import get_client, _enabled

    if _enabled() and get_client():
        key = f"ratelimit:{bucket}:{_client_key(request)}"
        if _redis_check(key, lim, window):
            raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {window} seconds.")
        return
    now = time.time()
    cutoff = now - window
    mem_key = f"{bucket}:{_client_key(request)}"
    hits = [t for t in _WRITE_BUCKETS[mem_key] if t >= cutoff]
    if len(hits) >= lim:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {window} seconds.")
    hits.append(now)
    _WRITE_BUCKETS[mem_key] = hits
