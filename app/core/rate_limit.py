"""Rate limiting for auth endpoints — Redis when REDIS_URL set, else in-memory."""
from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import DefaultDict, List

from fastapi import HTTPException, Request

_BUCKETS: DefaultDict[str, List[float]] = defaultdict(list)


def reset_rate_limits() -> None:
    """Tests and dev — clear in-memory buckets and Redis rate-limit keys."""
    _BUCKETS.clear()
    try:
        from app.core.cache import _enabled, get_client

        if _enabled() and get_client():
            r = get_client()
            for key in r.scan_iter("ratelimit:*", count=200):
                r.delete(key)
    except Exception:
        pass


def _limits() -> tuple[int, int]:
    return (
        int(os.getenv("AUTH_RATE_LIMIT", "20")),
        int(os.getenv("AUTH_RATE_WINDOW_SEC", "60")),
    )


def _client_key(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _redis_check(key: str, lim: int, window: int) -> bool:
    from app.core.cache import get_client

    r = get_client()
    if not r:
        return False
    try:
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        count, _ = pipe.execute()
        return int(count) > lim
    except Exception:
        return False


def check_auth_rate_limit(request: Request, action: str, *, limit: int | None = None, window_sec: int | None = None) -> None:
    default_lim, default_window = _limits()
    lim = limit if limit is not None else default_lim
    window = window_sec if window_sec is not None else default_window
    from app.core.cache import get_client, _enabled

    if _enabled() and get_client():
        key = f"ratelimit:{action}:{_client_key(request)}"
        if _redis_check(key, lim, window):
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Retry after {window} seconds.",
            )
        return
    now = time.time()
    cutoff = now - window
    mem_key = f"{action}:{_client_key(request)}"
    hits = [t for t in _BUCKETS[mem_key] if t >= cutoff]
    # ponytail: allow `lim` attempts — block the (lim+1)th (not when len==lim before add)
    if len(hits) >= lim:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Retry after {window} seconds.",
        )
    hits.append(now)
    _BUCKETS[mem_key] = hits
