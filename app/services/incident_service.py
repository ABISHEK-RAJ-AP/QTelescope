"""Correlate alerts into operational incidents (one open incident per backend)."""
from __future__ import annotations

import datetime
import time
import uuid
from collections import defaultdict
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.entities import AlertModel, BackendModel, IncidentAlertModel, IncidentModel

SEVERITY_RANK = {"INFO": 0, "WARNING": 1, "CRITICAL": 2}

_LAST_SYNC_MONO = 0.0
SYNC_THROTTLE_SEC = 45


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def backend_id_from_alert(alert: AlertModel) -> str:
    rid = alert.resource_id or ""
    if alert.resource_type == "QUBIT" and "_Q" in rid:
        return rid.rsplit("_Q", 1)[0]
    return rid


def _max_severity(alerts: List[AlertModel]) -> str:
    best = "INFO"
    for a in alerts:
        if SEVERITY_RANK.get(a.severity, 0) >= SEVERITY_RANK.get(best, 0):
            best = a.severity
    return best


def _incident_title(backend_id: str, alerts: List[AlertModel]) -> str:
    types = sorted({a.alert_type for a in alerts})
    return f"{backend_id} — {', '.join(types[:3])}" + ("…" if len(types) > 3 else "")


def sync_incidents_from_alerts_if_stale(db: Session, *, force: bool = False) -> int:
    """Throttle expensive sync on hot read paths (dashboard, list). POST /sync uses force=True."""
    global _LAST_SYNC_MONO
    now = time.monotonic()
    if not force and (now - _LAST_SYNC_MONO) < SYNC_THROTTLE_SEC:
        return 0
    n = sync_incidents_from_alerts(db)
    _LAST_SYNC_MONO = now
    return n


def sync_incidents_from_alerts(db: Session) -> int:
    """
    Upsert open incidents for backends with ACTIVE/ACKNOWLEDGED alerts.
    Returns number of incidents touched.
    """
    active = (
        db.query(AlertModel)
        .filter(AlertModel.status.in_(["ACTIVE", "ACKNOWLEDGED"]))
        .all()
    )
    by_backend: Dict[str, List[AlertModel]] = defaultdict(list)
    for a in active:
        bid = backend_id_from_alert(a)
        if bid:
            by_backend[bid].append(a)

    valid_backends = {r[0] for r in db.query(BackendModel.backend_id).all()}
    touched = 0
    now = _utcnow()

    for backend_id, alerts in by_backend.items():
        if not alerts or backend_id not in valid_backends:
            continue
        first = min(a.detected_at for a in alerts if a.detected_at)
        last = max(a.detected_at for a in alerts if a.detected_at)
        sev = _max_severity(alerts)

        inc = (
            db.query(IncidentModel)
            .filter(
                IncidentModel.backend_id == backend_id,
                IncidentModel.status.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"]),
            )
            .first()
        )
        if not inc:
            inc = IncidentModel(
                incident_id=f"inc_{uuid.uuid4().hex[:10]}",
                title=_incident_title(backend_id, alerts),
                backend_id=backend_id,
                severity=sev,
                status="OPEN",
                summary=f"{len(alerts)} related alert(s) on {backend_id}",
                first_detected_at=first or now,
                last_detected_at=last or now,
                created_at=now,
            )
            db.add(inc)
            db.flush()
        else:
            inc.last_detected_at = last or inc.last_detected_at
            inc.severity = _max_severity(alerts)
            inc.title = _incident_title(backend_id, alerts)
            inc.summary = f"{len(alerts)} related alert(s) on {backend_id}"

        linked = {
            row[0]
            for row in db.query(IncidentAlertModel.alert_id)
            .filter(IncidentAlertModel.incident_id == inc.incident_id)
            .all()
        }
        for a in alerts:
            if a.alert_id not in linked:
                db.add(IncidentAlertModel(incident_id=inc.incident_id, alert_id=a.alert_id))
                linked.add(a.alert_id)
        touched += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        return 0
    return touched
