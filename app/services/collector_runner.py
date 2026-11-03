"""Run one provider collection cycle with timeout and fault isolation."""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any, Callable, Dict, Tuple

logger = logging.getLogger("CollectorRunner")

DEFAULT_PROVIDER_TIMEOUT_S = 120


def run_provider_collection(
    provider_id: str,
    collect_fn: Callable[[], Dict[str, Any]],
    *,
    timeout_seconds: int = DEFAULT_PROVIDER_TIMEOUT_S,
) -> Tuple[str, Dict[str, Any], float]:
    """
    Returns (status, result_dict, duration_ms).
    status: OK | TIMEOUT | ERROR
    """
    started = time.perf_counter()

    def _wrapped() -> Dict[str, Any]:
        return collect_fn()

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_wrapped)
            result = future.result(timeout=timeout_seconds)
        duration_ms = (time.perf_counter() - started) * 1000
        return "OK", result, duration_ms
    except FuturesTimeout:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.error("Collector timeout for provider %s after %ss", provider_id, timeout_seconds)
        return "TIMEOUT", {"error": f"Collection exceeded {timeout_seconds}s"}, duration_ms
    except Exception as err:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.exception("Collector error for provider %s: %s", provider_id, err)
        return "ERROR", {"error": str(err)}, duration_ms
