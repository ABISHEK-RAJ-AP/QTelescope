"""Collector failure dead-letter log (IMP-P5)."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "collector_dlq.jsonl")
_MAX_READ = 200


def record_failure(
    provider_id: str,
    *,
    status: str,
    error: str | None = None,
    duration_ms: float | None = None,
) -> Dict[str, Any]:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)
    row = {
        "id": f"dlq_{uuid.uuid4().hex[:12]}",
        "provider_id": provider_id,
        "status": status,
        "error": (error or "")[:500],
        "duration_ms": duration_ms,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    with open(_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")
    return row


def purge_failures() -> int:
    if not os.path.isfile(_PATH):
        return 0
    with open(_PATH, encoding="utf-8") as fh:
        n = sum(1 for line in fh if line.strip())
    with open(_PATH, "w", encoding="utf-8"):
        pass
    return n


def list_failures(limit: int = 50) -> List[Dict[str, Any]]:
    if not os.path.isfile(_PATH):
        return []
    rows: List[Dict[str, Any]] = []
    with open(_PATH, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return list(reversed(rows[-limit:]))
