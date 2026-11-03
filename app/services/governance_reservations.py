"""Tenant-scoped resource reservations (file-backed until DB charter)."""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_LOCK = threading.Lock()
_STORE = Path(__file__).resolve().parents[2] / "data" / "governance_reservations.json"

RESERVATION_STATES = ("requested", "active", "released", "cancelled")
HOLD_STATES = frozenset({"requested", "active"})
TRANSITIONS = {
    "requested": frozenset({"active", "cancelled"}),
    "active": frozenset({"released", "cancelled"}),
    "released": frozenset(),
    "cancelled": frozenset(),
}


def _load() -> Dict[str, List[Dict[str, Any]]]:
    if not _STORE.exists():
        return {}
    try:
        with _STORE.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: Dict[str, List[Dict[str, Any]]]) -> None:
    _STORE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _STORE.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
    tmp.replace(_STORE)


def parse_window(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def windows_overlap(left: Dict[str, Any], right: Dict[str, Any]) -> bool:
    start_a, end_a = parse_window(left.get("window_start") or ""), parse_window(left.get("window_end") or "")
    start_b, end_b = parse_window(right.get("window_start") or ""), parse_window(right.get("window_end") or "")
    if not all((start_a, end_a, start_b, end_b)):
        return False
    return start_a < end_b and end_a > start_b


def annotate_conflicts(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    annotated: List[Dict[str, Any]] = []
    for row in rows:
        copy = dict(row)
        if copy.get("state") not in HOLD_STATES:
            copy["conflict_ids"] = []
            copy["has_conflict"] = False
            annotated.append(copy)
            continue
        conflicts = [
            other.get("reservation_id")
            for other in rows
            if other.get("reservation_id") != copy.get("reservation_id")
            and other.get("state") in HOLD_STATES
            and other.get("resource_ref") == copy.get("resource_ref")
            and windows_overlap(copy, other)
        ]
        copy["conflict_ids"] = [cid for cid in conflicts if cid]
        copy["has_conflict"] = bool(copy["conflict_ids"])
        annotated.append(copy)
    return annotated


def list_reservations(
    tenant_id: str,
    *,
    state: Optional[str] = None,
    project_id: Optional[str] = None,
    resource_ref: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with _LOCK:
        rows = _load().get(tenant_id, [])
    items = annotate_conflicts(rows)
    if state:
        items = [row for row in items if row.get("state") == state]
    if project_id:
        items = [row for row in items if row.get("project_id") == project_id]
    if resource_ref:
        items = [row for row in items if row.get("resource_ref") == resource_ref]
    return sorted(items, key=lambda r: r.get("created_at") or "", reverse=True)


def create_reservation(
    tenant_id: str,
    *,
    resource_ref: str,
    project_id: Optional[str],
    window_start: str,
    window_end: str,
    purpose: str,
    actor: str,
) -> Dict[str, Any]:
    start = parse_window(window_start)
    end = parse_window(window_end)
    if start is None or end is None:
        raise ValueError("window_start and window_end must be ISO-8601 datetimes")
    if end <= start:
        raise ValueError("window_end must be after window_start")
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "reservation_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "resource_ref": resource_ref.strip(),
        "project_id": (project_id or "").strip() or None,
        "window_start": window_start,
        "window_end": window_end,
        "purpose": purpose.strip(),
        "state": "requested",
        "created_by": actor,
        "created_at": now,
        "updated_at": now,
        "history": [{"state": "requested", "at": now, "actor": actor}],
    }
    with _LOCK:
        data = _load()
        existing = data.setdefault(tenant_id, [])
        annotated = annotate_conflicts(existing + [row])
        saved = next(item for item in annotated if item["reservation_id"] == row["reservation_id"])
        existing.append({k: v for k, v in saved.items() if k not in {"conflict_ids", "has_conflict"}})
        _save(data)
    return saved


def transition_reservation(
    tenant_id: str,
    reservation_id: str,
    *,
    state: str,
    actor: str,
) -> Dict[str, Any]:
    if state not in RESERVATION_STATES:
        raise ValueError(f"Invalid state: {state}")
    with _LOCK:
        data = _load()
        rows = data.get(tenant_id, [])
        for row in rows:
            if row.get("reservation_id") == reservation_id:
                current = row.get("state") or "requested"
                allowed = TRANSITIONS.get(current, frozenset())
                if state not in allowed:
                    raise ValueError(f"Cannot move {current} → {state}")
                now = datetime.now(timezone.utc).isoformat()
                row["state"] = state
                row["updated_at"] = now
                row["updated_by"] = actor
                history = list(row.get("history") or [])
                history.append({"state": state, "at": now, "actor": actor})
                row["history"] = history
                _save(data)
                for item in annotate_conflicts(rows):
                    if item.get("reservation_id") == reservation_id:
                        return item
                return dict(row)
    raise KeyError("reservation_not_found")
