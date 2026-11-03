"""Redis/Valkey cache with graceful fallback when unavailable."""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_client = None
_client_checked = False
_stats = {"hits": 0, "misses": 0, "errors": 0}


def _enabled() -> bool:
    if os.getenv("CACHE_ENABLED", "true").lower() in ("0", "false", "no"):
        return False
    return bool(os.getenv("REDIS_URL") or os.getenv("VALKEY_URL"))


def _redis_url() -> str:
    return os.getenv("REDIS_URL") or os.getenv("VALKEY_URL") or ""


def _namespace() -> str:
    return os.getenv("CACHE_NAMESPACE", "qtelescope")


def cache_key(*parts: str) -> str:
    return f"{_namespace()}:{':'.join(p for p in parts if p)}"


def get_client():
    if not _enabled():
        return None
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    url = _redis_url()
    try:
        import redis

        _client = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info("Cache connected (%s)", url.split("@")[-1])
    except Exception as exc:
        logger.warning("Cache unavailable — PostgreSQL only: %s", exc)
        _client = None
        _stats["errors"] += 1
    return _client


def cache_stats() -> dict:
    return dict(_stats)


def cache_get_json(key: str) -> Optional[Any]:
    r = get_client()
    if not r:
        return None
    try:
        raw = r.get(key)
        if raw is None:
            _stats["misses"] += 1
            return None
        _stats["hits"] += 1
        return json.loads(raw)
    except Exception as exc:
        logger.debug("cache get %s: %s", key, exc)
        _stats["errors"] += 1
        return None


def cache_set_json(key: str, value: Any, ttl_sec: int) -> None:
    r = get_client()
    if not r or ttl_sec <= 0:
        return
    try:
        r.setex(key, ttl_sec, json.dumps(value, default=str))
    except Exception as exc:
        logger.debug("cache set %s: %s", key, exc)
        _stats["errors"] += 1


def cache_delete(*keys: str) -> None:
    r = get_client()
    if not r or not keys:
        return
    try:
        r.delete(*keys)
    except Exception as exc:
        logger.debug("cache delete: %s", exc)
        _stats["errors"] += 1


def cache_delete_prefix(prefix: str) -> None:
    r = get_client()
    if not r:
        return
    try:
        cursor = 0
        while True:
            cursor, keys = r.scan(cursor, match=f"{prefix}*", count=200)
            if keys:
                r.delete(*keys)
            if cursor == 0:
                break
    except Exception as exc:
        logger.debug("cache delete_prefix %s: %s", prefix, exc)


def default_ttl(name: str, fallback: int) -> int:
    env = os.getenv(f"CACHE_TTL_{name.upper()}", "")
    if env.isdigit():
        return int(env)
    return fallback


def get_or_set_json(key: str, ttl_sec: int, factory: Callable[[], T]) -> T:
    cached = cache_get_json(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    value = factory()
    cache_set_json(key, value, ttl_sec)
    return value


def invalidate_operational_cache() -> None:
    """Drop hot summaries after telemetry / alert / incident writes."""
    ns = _namespace()
    cache_delete_prefix(f"{ns}:health:")
    cache_delete_prefix(f"{ns}:alerts:")
    cache_delete_prefix(f"{ns}:fleet:")


def cache_health() -> dict:
    r = get_client()
    if not r:
        return {"enabled": _enabled(), "connected": False, "stats": cache_stats()}
    try:
        t0 = time.perf_counter()
        r.ping()
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {"enabled": True, "connected": True, "latency_ms": latency_ms, "stats": cache_stats()}
    except Exception as exc:
        return {"enabled": True, "connected": False, "error": str(exc), "stats": cache_stats()}
