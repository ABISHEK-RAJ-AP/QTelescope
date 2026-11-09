"""Persist per-provider collector run outcomes (JSON file until DB model in S1.2)."""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

_LOCK = threading.RLock()
_DEFAULT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "collector_health.json",
)


def _path() -> str:
    return os.environ.get("COLLECTOR_HEALTH_PATH", _DEFAULT_PATH)


def _ensure_dir():
    os.makedirs(os.path.dirname(_path()) or ".", exist_ok=True)


def load_all() -> Dict[str, Any]:
    with _LOCK:
        p = _path()
        if not os.path.isfile(p):
            return {"providers": {}, "updated_at": None}
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"providers": {}, "updated_at": None}


def record_provider_run(
    provider_id: str,
    *,
    status: str,
    duration_ms: float,
    backends_detected: int = 0,
    lineage: Optional[str] = None,
    error: Optional[str] = None,
    backend_names: Optional[List[str]] = None,
) -> None:
    from app.services.collector_executions import append_execution
    from app.services.ingestion_quality import record_quality

    append_execution(
        provider_id,
        status=status,
        duration_ms=duration_ms,
        backends_detected=backends_detected,
        lineage=lineage,
        error=error,
        backend_names=backend_names,
    )
    record_quality(
        provider_id,
        status=status,
        backends_detected=backends_detected,
        duration_ms=duration_ms,
        lineage=lineage,
        error=error,
    )
    now = datetime.now(timezone.utc).isoformat()
    with _LOCK:
        _ensure_dir()
        data = load_all()
        providers = data.setdefault("providers", {})
        providers[provider_id] = {
            "provider_id": provider_id,
            "status": status,
            "duration_ms": round(duration_ms, 2),
            "backends_detected": backends_detected,
            "lineage": lineage,
            "error": error,
            "backend_names": backend_names or [],
            "last_run_at": now,
            "last_success_at": now if status == "OK" else providers.get(provider_id, {}).get("last_success_at"),
        }
        data["updated_at"] = now
        with open(_path(), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)


def list_provider_health() -> List[Dict[str, Any]]:
    data = load_all()
    return list(data.get("providers", {}).values())
