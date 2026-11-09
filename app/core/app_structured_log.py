"""Append-only structured application logs (JSONL) for operator log explorer."""
from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.log_context import collector_trigger_ctx, request_id_ctx

_LOCK = threading.RLock()
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "app_structured.jsonl",
)
_MAX_BYTES = int(os.getenv("APP_STRUCTURED_LOG_MAX_BYTES", str(8 * 1024 * 1024)))
_REDACT = re.compile(r"(password|token|secret|mfa|api[_-]?key|authorization)", re.I)


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)


def _redact_context(ctx: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in (ctx or {}).items():
        if _REDACT.search(str(k)):
            out[k] = "[redacted]"
        elif isinstance(v, str) and len(v) > 500:
            out[k] = v[:500] + "…"
        else:
            out[k] = v
    return out


def emit_app_log(
    *,
    severity: str,
    service: str,
    component: str,
    message: str,
    event_code: Optional[str] = None,
    backend_id: Optional[str] = None,
    provider_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": (severity or "INFO")[:12].upper(),
        "service": (service or "qtelescope")[:64],
        "component": (component or "core")[:64],
        "message": (message or "")[:2000],
        "event_code": (event_code or "")[:64] or None,
        "request_id": request_id_ctx.get() or None,
        "backend_id": backend_id,
        "provider_id": provider_id,
        "collector_trigger": collector_trigger_ctx.get() or None,
        "context": _redact_context(context or {}),
    }
    with _LOCK:
        _ensure_dir()
        with open(_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")
        _trim_if_needed()
    return row


def _trim_if_needed() -> None:
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


def search_app_logs(
    *,
    limit: int = 100,
    q: Optional[str] = None,
    request_id: Optional[str] = None,
    backend_id: Optional[str] = None,
    provider_id: Optional[str] = None,
    severity: Optional[str] = None,
    service: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 300))
    if not os.path.isfile(_PATH):
        return []
    needle = (q or "").strip().lower()
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
                if request_id and request_id not in (rec.get("request_id") or ""):
                    continue
                if backend_id and rec.get("backend_id") != backend_id:
                    continue
                if provider_id and rec.get("provider_id") != provider_id:
                    continue
                if severity and (rec.get("severity") or "").upper() != severity.upper():
                    continue
                if service and (rec.get("service") or "") != service:
                    continue
                if needle:
                    blob = json.dumps(rec, default=str).lower()
                    if needle not in blob:
                        continue
                rows.append(rec)
    except OSError:
        return []
    return rows[-limit:][::-1]
