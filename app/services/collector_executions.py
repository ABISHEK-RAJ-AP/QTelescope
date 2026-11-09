"""Append-only collector run history (JSONL) for operator forensics."""
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
    "collector_executions.jsonl",
)
_MAX_BYTES = int(os.getenv("COLLECTOR_EXECUTIONS_MAX_BYTES", str(5 * 1024 * 1024)))


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)


def _trim_if_needed() -> None:
    # ponytail: size cap — drop oldest half when file too large
    if not os.path.isfile(_PATH) or os.path.getsize(_PATH) <= _MAX_BYTES:
        return
    try:
        with open(_PATH, encoding="utf-8") as fh:
            lines = fh.readlines()
        keep = lines[len(lines) // 2 :]
        with open(_PATH, "w", encoding="utf-8") as fh:
            fh.writelines(keep)
    except OSError:
        pass


def append_execution(
    provider_id: str,
    *,
    status: str,
    duration_ms: float,
    backends_detected: int = 0,
    lineage: Optional[str] = None,
    error: Optional[str] = None,
    backend_names: Optional[List[str]] = None,
    trigger_type: str = "scheduled",
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    from app.core.log_context import request_id_ctx

    rid = request_id or request_id_ctx.get() or None
    row = {
        "execution_id": f"cex_{uuid.uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider_id": provider_id,
        "trigger_type": (trigger_type or "scheduled")[:32],
        "request_id": rid,
        "status": status,
        "duration_ms": round(duration_ms, 2),
        "backends_detected": backends_detected,
        "lineage": lineage,
        "error": (error or "")[:500] or None,
        "backend_names": (backend_names or [])[:20],
    }
    with _LOCK:
        _ensure_dir()
        with open(_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")
        _trim_if_needed()
    return row


def list_executions(
    *,
    limit: int = 50,
    provider_id: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 500))
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
                if status and rec.get("status") != status:
                    continue
                rows.append(rec)
    except OSError:
        return []
    return rows[-limit:][::-1]
