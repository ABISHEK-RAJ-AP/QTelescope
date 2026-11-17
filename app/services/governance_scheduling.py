"""Tenant scheduling policy (business hours, blackouts) — file-backed v1."""
from __future__ import annotations

import json
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

_LOCK = threading.Lock()
_STORE = Path(__file__).resolve().parents[2] / "data" / "governance_scheduling.json"

WEEKDAYS = frozenset({"mon", "tue", "wed", "thu", "fri", "sat", "sun"})
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SCHEMA_VERSION = 1


def _load() -> Dict[str, Any]:
    if not _STORE.exists():
        return {}
    try:
        with _STORE.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: Dict[str, Any]) -> None:
    _STORE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _STORE.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
    tmp.replace(_STORE)


def _scope_key(tenant_id: str, facility_id: Optional[str]) -> str:
    fid = (facility_id or "").strip() or "_default"
    return f"{tenant_id}::{fid}"


def _empty(tenant_id: str, facility_id: Optional[str]) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "configured": False,
        "tenant_id": tenant_id,
        "facility_id": facility_id,
        "timezone": None,
        "weekday_hours": {},
        "blackout_dates": [],
        "blackout_windows": [],
        "updated_at": None,
        "updated_by": None,
    }


def get_scheduling_config(tenant_id: str, facility_id: Optional[str] = None) -> Dict[str, Any]:
    key = _scope_key(tenant_id, facility_id)
    with _LOCK:
        raw = _load().get(key)
    if not raw:
        return _empty(tenant_id, facility_id)
    out = _empty(tenant_id, facility_id)
    out.update(raw)
    out["configured"] = bool(raw.get("timezone") or raw.get("weekday_hours") or raw.get("blackout_dates"))
    out["tenant_id"] = tenant_id
    out["facility_id"] = facility_id
    return out


def _validate_time(label: str, value: str) -> None:
    if not _TIME_RE.match(value or ""):
        raise ValueError(f"{label} must be HH:MM (24h)")


def _validate_weekday_hours(hours: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    if not isinstance(hours, dict):
        raise ValueError("weekday_hours must be an object")
    out: Dict[str, Dict[str, str]] = {}
    for day, slot in hours.items():
        key = str(day).lower()
        if key not in WEEKDAYS:
            raise ValueError(f"invalid weekday: {day}")
        if not isinstance(slot, dict):
            raise ValueError(f"weekday_hours.{key} must be an object")
        open_t = str(slot.get("open") or "").strip()
        close_t = str(slot.get("close") or "").strip()
        _validate_time(f"weekday_hours.{key}.open", open_t)
        _validate_time(f"weekday_hours.{key}.close", close_t)
        if open_t >= close_t:
            raise ValueError(f"weekday_hours.{key}: open must be before close")
        out[key] = {"open": open_t, "close": close_t}
    return out


def _validate_blackout_dates(dates: List[Any]) -> List[str]:
    if not isinstance(dates, list):
        raise ValueError("blackout_dates must be a list")
    out: List[str] = []
    for d in dates:
        s = str(d).strip()
        if not _DATE_RE.match(s):
            raise ValueError(f"blackout_dates entry must be YYYY-MM-DD: {s}")
        out.append(s)
    return sorted(set(out))


def _parse_iso(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"invalid ISO datetime: {value}") from exc


def _validate_blackout_windows(windows: List[Any]) -> List[Dict[str, str]]:
    if not isinstance(windows, list):
        raise ValueError("blackout_windows must be a list")
    out: List[Dict[str, str]] = []
    for i, row in enumerate(windows):
        if not isinstance(row, dict):
            raise ValueError(f"blackout_windows[{i}] must be an object")
        start = str(row.get("start") or "").strip()
        end = str(row.get("end") or "").strip()
        reason = str(row.get("reason") or "").strip()[:512]
        if not start or not end:
            raise ValueError(f"blackout_windows[{i}] requires start and end")
        s_dt, e_dt = _parse_iso(start), _parse_iso(end)
        if s_dt >= e_dt:
            raise ValueError(f"blackout_windows[{i}]: start must be before end")
        out.append({"start": start, "end": end, "reason": reason})
    return out


def upsert_scheduling_config(
    tenant_id: str,
    *,
    timezone: str,
    weekday_hours: Dict[str, Any],
    blackout_dates: List[Any],
    blackout_windows: List[Any],
    facility_id: Optional[str] = None,
    actor: str = "system",
) -> Dict[str, Any]:
    tz = (timezone or "").strip()
    if not tz:
        raise ValueError("timezone is required")
    try:
        ZoneInfo(tz)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"unknown timezone: {tz}") from exc

    row = {
        "schema_version": SCHEMA_VERSION,
        "tenant_id": tenant_id,
        "facility_id": facility_id,
        "timezone": tz,
        "weekday_hours": _validate_weekday_hours(weekday_hours or {}),
        "blackout_dates": _validate_blackout_dates(blackout_dates or []),
        "blackout_windows": _validate_blackout_windows(blackout_windows or []),
        "updated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "updated_by": actor,
    }
    key = _scope_key(tenant_id, facility_id)
    with _LOCK:
        data = _load()
        data[key] = row
        _save(data)
    out = get_scheduling_config(tenant_id, facility_id=facility_id)
    out["configured"] = True
    return out