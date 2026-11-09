"""Facility telemetry ingest — REST + JSON file + inbox scan. MQTT NOT_BUILT."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from app.facility import env_store
from app.facility.env_store import CHANNELS, load_rows, save_rows
from app.facility.mqtt_boundary import mqtt_ingest_status


def _validate_record(rec: Dict[str, Any]) -> None:
    if rec.get("channel") not in CHANNELS:
        raise ValueError(f"Unknown channel: {rec.get('channel')}")
    if not rec.get("backend_id"):
        raise ValueError("backend_id required")
    float(rec.get("value"))


MAX_ENV_ROWS = 50_000
MAX_BATCH = 2_000


def append_records(records: List[Dict[str, Any]], source: str = "rest") -> Tuple[int, List[str]]:
    if len(records) > MAX_BATCH:
        return 0, [f"Batch exceeds {MAX_BATCH} records"]
    rows = load_rows()
    if len(rows) >= MAX_ENV_ROWS:
        return 0, [f"Store at capacity ({MAX_ENV_ROWS} rows)"]
    added = 0
    errors: List[str] = []
    now = datetime.now(timezone.utc).isoformat()
    for rec in records:
        try:
            _validate_record(rec)
        except (TypeError, ValueError) as exc:
            errors.append(str(exc))
            continue
        rows.append(
            {
                "timestamp": rec.get("timestamp") or now,
                "backend_id": rec["backend_id"],
                "channel": rec["channel"],
                "value": float(rec["value"]),
                "unit": rec.get("unit") or "",
                "severity": rec.get("severity"),
                "source": source,
            }
        )
        added += 1
    if added:
        save_rows(rows)
    return added, errors


def ingest_status() -> Dict[str, Any]:
    inbox_n = 0
    inbox = env_store.FACILITY_INBOX
    if os.path.isdir(inbox):
        inbox_n = sum(1 for f in os.listdir(inbox) if f.endswith(".json"))
    return {
        "rest_ingest": "LIVE",
        "file_import": "LIVE",
        "inbox_scan": "LIVE",
        "mqtt_subscriber": mqtt_ingest_status().get("status", "DISABLED"),
        "vendor_cryo_rf_adapter": "LIVE",
        "inbox_pending_files": inbox_n,
        "storage_path": env_store.ENV_PATH,
        "inbox_path": inbox,
    }


def scan_inbox() -> Dict[str, Any]:
    inbox = env_store.FACILITY_INBOX
    os.makedirs(inbox, exist_ok=True)
    processed = 0
    added_total = 0
    errors: List[str] = []
    for name in sorted(os.listdir(inbox)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(inbox, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{name}: {exc}")
            continue
        records = payload.get("records") if isinstance(payload, dict) else payload
        if not isinstance(records, list):
            errors.append(f"{name}: expected records array")
            continue
        added, rec_errors = append_records(records, source=f"inbox:{name}")
        added_total += added
        errors.extend(rec_errors)
        processed += 1
        done_path = path + ".processed"
        try:
            os.replace(path, done_path)
        except OSError:
            pass
    return {"files_processed": processed, "records_added": added_total, "errors": errors}
