"""Per-provider collector circuit breaker (IMP-P5)."""
from __future__ import annotations

import json
import os
import threading
import time
from typing import Dict

_LOCK = threading.RLock()
_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "collector_circuit.json")
FAIL_THRESHOLD = int(os.getenv("COLLECTOR_CIRCUIT_FAILS", "3"))
COOLDOWN_SEC = int(os.getenv("COLLECTOR_CIRCUIT_COOLDOWN_SEC", "300"))


def _load() -> Dict[str, dict]:
    if not os.path.isfile(_PATH):
        return {}
    try:
        with open(_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save(data: Dict[str, dict]) -> None:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)
    with open(_PATH, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def record_outcome(provider_id: str, status: str) -> None:
    with _LOCK:
        data = _load()
        st = data.setdefault(provider_id, {"failures": 0, "open_until": 0.0})
        if status == "OK":
            st["failures"] = 0
            st["open_until"] = 0.0
        else:
            st["failures"] = int(st.get("failures", 0)) + 1
            if st["failures"] >= FAIL_THRESHOLD:
                st["open_until"] = time.time() + COOLDOWN_SEC
        _save(data)


def is_open(provider_id: str) -> bool:
    st = _load().get(provider_id) or {}
    return float(st.get("open_until") or 0) > time.time()


def snapshot() -> Dict[str, dict]:
    return _load()
