"""Per-provider ingestion quality snapshots (JSONL)."""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

_LOCK = threading.RLock()
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "ingestion_quality.jsonl",
)
SCHEMA_VERSION = 2
_RETENTION_DAYS = int(os.getenv("INGESTION_QUALITY_RETENTION_DAYS", "30"))


def _trim_by_retention() -> None:
    if not os.path.isfile(_PATH) or _RETENTION_DAYS <= 0:
        return
    cutoff = (datetime.now(timezone.utc) - timedelta(days=_RETENTION_DAYS)).isoformat()
    try:
        with open(_PATH, encoding="utf-8") as fh:
            lines = fh.readlines()
        keep: List[str] = []
        for line in lines:
            raw = line.strip()
            if not raw:
                continue
            try:
                rec = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if (rec.get("timestamp") or "") >= cutoff:
                keep.append(line if line.endswith("\n") else f"{raw}\n")
        if len(keep) < len(lines):
            with open(_PATH, "w", encoding="utf-8") as fh:
                fh.writelines(keep if keep else [])
    except OSError:
        pass


def _quality_outcome(status: str, backends_detected: int, stats: Optional[Dict[str, Any]]) -> str:
    if status != "OK":
        return "FAIL"
    stats = stats or {}
    processed = int(stats.get("backends_processed") or backends_detected or 0)
    tel_rows = stats.get("backend_telemetry_rows")
    if processed > 0 and tel_rows is not None and int(tel_rows) < processed:
        return "PARTIAL"
    return "OK"


def record_quality(
    provider_id: str,
    *,
    status: str,
    backends_detected: int,
    duration_ms: float,
    lineage: Optional[str] = None,
    error: Optional[str] = None,
    collection_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """v2: measured row counts from collector cycle when available — no fabricated reject/duplicate counts."""
    stats = collection_stats or {}
    processed = int(stats.get("backends_processed") or backends_detected or 0)
    tel_rows = stats.get("backend_telemetry_rows")
    cal_rows = stats.get("calibration_snapshots")
    received = backends_detected if status == "OK" else 0
    expected = processed if status == "OK" else max(backends_detected, 0)
    outcome = _quality_outcome(status, backends_detected, stats)
    completeness = 100.0 if outcome == "OK" and received > 0 else (50.0 if outcome == "PARTIAL" else 0.0)
    if status == "OK" and received == 0:
        completeness = 100.0

    row = {
        "report_id": f"iqr_{uuid.uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "schema_version": SCHEMA_VERSION,
        "provider_id": provider_id,
        "status": status,
        "quality_outcome": outcome,
        "expected_backends": expected,
        "received_backends": received,
        "backends_processed": processed,
        "backend_telemetry_rows": tel_rows,
        "calibration_snapshots": cal_rows,
        "valid_cycles": 1 if status == "OK" else 0,
        "completeness_pct": round(completeness, 2),
        "duration_ms": round(duration_ms, 2),
        "lineage": lineage,
        "error": (error or "")[:300] or None,
        "rejected_records": None,
        "duplicate_records": None,
    }
    with _LOCK:
        os.makedirs(os.path.dirname(_PATH), exist_ok=True)
        with open(_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")
        _trim_by_retention()
    return row


def list_quality(
    *,
    limit: int = 30,
    provider_id: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 200))
    if not os.path.isfile(_PATH):
        return []
    rows: List[Dict[str, Any]] = []
    try:
        with open(_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ts = rec.get("timestamp") or ""
                if since and ts < since:
                    continue
                if until and ts > until:
                    continue
                if provider_id and rec.get("provider_id") != provider_id:
                    continue
                rows.append(rec)
    except OSError:
        return []
    return rows[-limit:][::-1]


def latest_by_provider(limit_per: int = 1) -> List[Dict[str, Any]]:
    rows = list_quality(limit=500)
    seen: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        pid = r.get("provider_id")
        if pid and pid not in seen:
            seen[pid] = r
        if len(seen) >= limit_per * 20:
            break
    return list(seen.values())
