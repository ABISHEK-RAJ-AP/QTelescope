"""Last hardware discovery run — read APIs use this, not live discovery."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.providers.catalog import DATA_DIR

_STATUS_PATH = os.path.join(DATA_DIR, "discovery_status.json")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_discovery_run(result: Optional[Dict[str, Any]], *, trigger: str = "scheduled") -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    payload = {
        "last_run_at": _utc_now(),
        "trigger": trigger,
        "status": (result or {}).get("status"),
        "total_backends_discovered": (result or {}).get("total_backends_discovered"),
        "providers": (result or {}).get("providers"),
        "error": (result or {}).get("error"),
    }
    with open(_STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def get_discovery_status() -> Dict[str, Any]:
    if not os.path.exists(_STATUS_PATH):
        return {
            "last_run_at": None,
            "trigger": None,
            "status": "unknown",
            "note": "No discovery run recorded yet (scheduler or admin trigger).",
        }
    try:
        with open(_STATUS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {"status": "invalid_store"}
    except (OSError, json.JSONDecodeError) as exc:
        return {"status": "error", "error": str(exc)[:200]}