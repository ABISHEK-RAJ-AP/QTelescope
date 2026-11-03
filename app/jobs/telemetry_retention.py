"""Configurable telemetry purge (IMP-P4)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.entities import BackendTelemetryModel, GateTelemetryModel, QubitTelemetryModel


def retention_policy() -> Dict[str, Any]:
    days = int(os.getenv("TELEMETRY_RETENTION_DAYS", "90"))
    days = max(7, min(days, 3650))
    return {
        "telemetry_retention_days": days,
        "auto_run_on_startup": os.getenv("TELEMETRY_RETENTION_ON_STARTUP", "false").lower()
        in ("1", "true", "yes"),
        "targets": ["qubit_telemetry", "backend_telemetry", "gate_telemetry"],
    }


def run_telemetry_retention(db: Session, days: int | None = None) -> Dict[str, int]:
    policy = retention_policy()
    keep_days = days if days is not None else policy["telemetry_retention_days"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)

    deleted: Dict[str, int] = {}
    for name, model in (
        ("qubit_telemetry", QubitTelemetryModel),
        ("backend_telemetry", BackendTelemetryModel),
        ("gate_telemetry", GateTelemetryModel),
    ):
        q = db.query(model).filter(model.timestamp < cutoff)
        count = q.delete(synchronize_session=False)
        deleted[name] = int(count or 0)
    db.commit()
    return deleted
