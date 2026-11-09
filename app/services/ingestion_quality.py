"""Per-provider ingestion quality snapshots (JSONL)."""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

_LOCK = threading.RLock()
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "ingestion_quality.jsonl",
)


def record_quality(
    provider_id: str,
    *,
    status: str,
    backends_detected: int,
    duration_ms: float,
    lineage: Optional[str] = None,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    """v1: completeness from collection outcome (not per-metric counts yet)."""
    valid = 1 if status == "OK" else 0
    received = backends_detected if status == "OK" else 0
    expected = received if status == "OK" else max(backends_detected, 0)
    completeness = 100.0 if status == "OK" and received > 0 else (0.0 if status != "OK" else 0.0)
    if status == "OK" and received == 0:
        completeness = 100.0  # poll succeeded, zero backends is valid

    row = {
        "report_id": f"iqr_{uuid.uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider_id": provider_id,
        "status": status,
        "expected_backends": expected,
        "received_backends": received,
        "valid_cycles": valid,
        "completeness_pct": round(completeness, 2),
        "duration_ms": round(duration_ms, 2),
        "lineage": lineage,
        "error": (error or "")[:300] or None,
    }
    with _LOCK:
        os.makedirs(os.path.dirname(_PATH), exist_ok=True)
        with open(_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")
    return row


def list_quality(*, limit: int = 30, provider_id: Optional[str] = None) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 100))
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
                if provider_id and rec.get("provider_id") != provider_id:
                    continue
                rows.append(rec)
    except OSError:
        return []
    return rows[-limit:][::-1]
