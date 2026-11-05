"""Admin-defined roles stored as JSON. Permissions must be from PERMS."""
from __future__ import annotations

import json
import os
import re
import threading
from typing import Any, Dict, List

_LOCK = threading.Lock()
_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "custom_roles.json")
_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,39}$")


def _path() -> str:
    return os.path.abspath(_PATH)


def load_raw() -> List[Dict[str, Any]]:
    path = _path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _save(rows: List[Dict[str, Any]]) -> None:
    path = _path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, indent=2)
    os.replace(tmp, path)


def as_permission_map() -> Dict[str, frozenset]:
    from app.core.permissions import PERMS

    out: Dict[str, frozenset] = {}
    for row in load_raw():
        rid = str(row.get("id") or "")
        perms = [p for p in (row.get("permissions") or []) if p in PERMS]
        if rid:
            out[rid] = frozenset(perms)
    return out


def labels() -> Dict[str, str]:
    return {str(r.get("id")): str(r.get("label") or r.get("id")) for r in load_raw() if r.get("id")}


def upsert(role_id: str, label: str, permissions: List[str]) -> Dict[str, Any]:
    from app.core.permissions import PERMS, builtin_role_ids

    rid = (role_id or "").strip()
    if not _ID_RE.match(rid):
        raise ValueError("Role id must start with a letter and use letters, digits, underscore.")
    if rid in builtin_role_ids():
        raise ValueError("Cannot overwrite a built-in role.")
    clean = sorted({p for p in permissions if p in PERMS})
    if not clean:
        raise ValueError("Pick at least one known permission.")
    row = {"id": rid, "label": (label or rid).strip(), "permissions": clean}
    with _LOCK:
        rows = [r for r in load_raw() if str(r.get("id")) != rid]
        rows.append(row)
        rows.sort(key=lambda r: str(r.get("id") or ""))
        _save(rows)
    return row


def delete(role_id: str) -> bool:
    from app.core.permissions import builtin_role_ids

    rid = (role_id or "").strip()
    if rid in builtin_role_ids():
        raise ValueError("Cannot delete a built-in role.")
    with _LOCK:
        rows = load_raw()
        next_rows = [r for r in rows if str(r.get("id")) != rid]
        if len(next_rows) == len(rows):
            return False
        _save(next_rows)
    return True
