"""Append-only operator audit log (jsonl)."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import inspect

from app.core.database import SessionLocal, engine
from app.models.entities import AuditEventModel

_AUDIT_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "audit_events.jsonl")


def record_audit(
    action: str,
    *,
    actor: Optional[str] = None,
    role: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> None:
    os.makedirs(os.path.dirname(_AUDIT_PATH), exist_ok=True)
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "actor": actor or "unknown",
        "role": role,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "detail": detail or {},
    }
    with open(_AUDIT_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, default=str) + "\n")
    try:
        if inspect(engine).has_table("audit_events"):
            db = SessionLocal()
            try:
                db.add(
                    AuditEventModel(
                        action=action,
                        actor=actor or "unknown",
                        role=role,
                        resource_type=resource_type,
                        resource_id=resource_id,
                        detail=detail or {},
                    )
                )
                db.commit()
            finally:
                db.close()
    except Exception:
        pass  # ponytail: jsonl remains source of truth if DB write fails


def search_audit(
    *,
    limit: int = 100,
    action: Optional[str] = None,
    actor: Optional[str] = None,
    resource_id: Optional[str] = None,
    q: Optional[str] = None,
) -> list:
    """Read recent audit events from JSONL (newest first)."""
    limit = max(1, min(limit, 500))
    if not os.path.isfile(_AUDIT_PATH):
        return []
    needle = (q or "").strip().lower()
    action_prefix = (action or "").strip()
    actor_match = (actor or "").strip().lower()
    resource_match = (resource_id or "").strip()
    rows = []
    try:
        with open(_AUDIT_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if action_prefix and not str(rec.get("action") or "").startswith(action_prefix):
                    continue
                if actor_match and actor_match not in str(rec.get("actor") or "").lower():
                    continue
                if resource_match and resource_match not in str(rec.get("resource_id") or ""):
                    continue
                if needle:
                    blob = json.dumps(rec, default=str).lower()
                    if needle not in blob:
                        continue
                rows.append(rec)
    except OSError:
        return []
    return rows[-limit:][::-1]
