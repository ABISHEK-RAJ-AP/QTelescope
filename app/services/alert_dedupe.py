"""Collapse duplicate open alerts that share resource + rule (keep newest)."""
from __future__ import annotations

import datetime
from typing import List

from sqlalchemy.orm import Session

from app.models.entities import AlertModel

OPEN_STATUSES = ("ACTIVE", "ACKNOWLEDGED")


def _alert_fingerprint(alert: AlertModel) -> str:
    return f"{alert.resource_type}:{alert.resource_id}:{alert.alert_type}"


def dedupe_open_alerts(db: Session) -> int:
    """
    Resolve older duplicates when multiple ACTIVE/ACKNOWLEDGED rows share the same key.
    Newest detected_at wins.
    """
    rows: List[AlertModel] = (
        db.query(AlertModel)
        .filter(AlertModel.status.in_(OPEN_STATUSES))
        .order_by(AlertModel.detected_at.desc())
        .all()
    )
    seen: set[str] = set()
    now = datetime.datetime.utcnow()
    resolved = 0
    for alert in rows:
        key = _alert_fingerprint(alert)
        if key in seen:
            alert.status = "RESOLVED"
            alert.resolved_at = now
            resolved += 1
        else:
            seen.add(key)
    return resolved
