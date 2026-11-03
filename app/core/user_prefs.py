"""Per-user preferences (JSON file; mirrors Cert Studio prefs shape where useful)."""
from __future__ import annotations

import json
import os
import threading
from typing import Any, Dict

_LOCK = threading.Lock()
_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "user_preferences.json")


def _load() -> Dict[str, Dict[str, Any]]:
    path = os.path.abspath(_PATH)
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save(blob: Dict[str, Dict[str, Any]]) -> None:
    path = os.path.abspath(_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(blob, fh, indent=2)
    os.replace(tmp, path)


def get_preferences(username: str) -> Dict[str, Any]:
    with _LOCK:
        return dict(_load().get(username) or {})


def set_preferences(username: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        all_p = _load()
        cur = dict(all_p.get(username) or {})
        cur.update({k: v for k, v in patch.items() if v is not None})
        all_p[username] = cur
        _save(all_p)
        return cur
