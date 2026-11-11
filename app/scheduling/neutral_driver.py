"""Neutral schedule driver — swap implementations without changing API or UI contracts."""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.entities import CollectionScheduleModel
from app.workers.collection_scheduler import TICK_SECONDS, scheduler_enabled, run_due_collections

DRIVER_BACKGROUND = "background_tick"
DRIVER_ON_DEMAND = "on_demand"


def resolve_driver_id() -> str:
    mode = os.getenv("COLLECTION_SCHEDULER_DRIVER", "background_tick").strip().lower()
    if mode in ("on_demand", "manual", "off"):
        return DRIVER_ON_DEMAND
    return DRIVER_BACKGROUND


def scheduler_snapshot(db: Session) -> Dict[str, Any]:
    schedules: List[CollectionScheduleModel] = db.query(CollectionScheduleModel).all()
    driver = resolve_driver_id()
    enabled = scheduler_enabled() and driver == DRIVER_BACKGROUND
    return {
        "driver": driver,
        "driver_label": "Background tick" if driver == DRIVER_BACKGROUND else "On demand",
        "enabled": enabled,
        "tick_seconds": TICK_SECONDS,
        "mode_note": (
            "Interval schedules run on a background tick loop."
            if enabled
            else "Background loop disabled — use Run collection now or enable COLLECTION_SCHEDULER_ENABLED."
        ),
        "schedules": [
            {
                "category": s.category,
                "interval_seconds": s.interval_seconds,
                "enabled": s.enabled,
                "last_run": s.last_run.isoformat() if s.last_run else None,
            }
            for s in schedules
        ],
    }


def run_driver_tick() -> Optional[dict]:
    """Entry for workers/cron — respects on-demand driver."""
    if resolve_driver_id() != DRIVER_BACKGROUND or not scheduler_enabled():
        return None
    return run_due_collections()
