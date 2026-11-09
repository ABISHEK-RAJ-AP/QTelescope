"""SLI measurements from durable JSONL sources (v1 — collector success rate)."""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

_LOCK = threading.RLock()
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "sli_measurements.jsonl",
)
COLLECTOR_SLI_ID = "collector_execution_success"
COLLECTOR_SLO_TARGET = float(os.getenv("COLLECTOR_SLO_TARGET", "0.95"))
WINDOW_HOURS = int(os.getenv("COLLECTOR_SLI_WINDOW_HOURS", "24"))
RECORD_INTERVAL_S = int(os.getenv("SLI_RECORD_INTERVAL_S", "3600"))


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)


def compute_collector_execution_sli() -> Dict[str, Any]:
    from app.services.collector_executions import list_executions

    since = (datetime.now(timezone.utc) - timedelta(hours=WINDOW_HOURS)).isoformat()
    rows = list_executions(limit=500, since=since)
    ok = sum(1 for r in rows if r.get("status") == "OK")
    total = len(rows)
    value = round(ok / total, 4) if total else None
    return {
        "sli_id": COLLECTOR_SLI_ID,
        "name": "Collector execution success rate",
        "description": f"Share of provider collection runs with status OK in the last {WINDOW_HOURS}h",
        "numerator": ok,
        "denominator": total,
        "value": value,
        "target": COLLECTOR_SLO_TARGET,
        "compliant": value is not None and value >= COLLECTOR_SLO_TARGET,
        "window_hours": WINDOW_HOURS,
        "data_source": "data/collector_executions.jsonl",
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "missing_data": total == 0,
    }


def _last_recorded_at(sli_id: str) -> Optional[str]:
    if not os.path.isfile(_PATH):
        return None
    try:
        with open(_PATH, encoding="utf-8") as fh:
            last = None
            for line in fh:
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if rec.get("sli_id") == sli_id:
                    last = rec.get("measured_at")
            return last
    except OSError:
        return None


def record_sli_snapshot(sli: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        _ensure_dir()
        with open(_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(sli, default=str) + "\n")
    return sli


def maybe_record_hourly_slis() -> List[Dict[str, Any]]:
    """Append measurement if older than RECORD_INTERVAL_S (ponytail: triggered from platform-health)."""
    out: List[Dict[str, Any]] = []
    sli = compute_collector_execution_sli()
    last = _last_recorded_at(COLLECTOR_SLI_ID)
    due = True
    if last:
        try:
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            due = (datetime.now(timezone.utc) - last_dt).total_seconds() >= RECORD_INTERVAL_S
        except ValueError:
            due = True
    if due:
        record_sli_snapshot(sli)
    out.append(sli)
    return out


def latest_slis_for_ui() -> List[Dict[str, Any]]:
    return maybe_record_hourly_slis()
