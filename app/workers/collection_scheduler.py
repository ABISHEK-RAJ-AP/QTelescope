"""Background polling driven by CollectionScheduleModel intervals."""
from __future__ import annotations

import asyncio
import datetime
import logging
import os
from typing import Optional

from app.core.database import SessionLocal
from app.discovery.hardware_discovery import HardwareDiscoveryEngine
from app.models.entities import CollectionScheduleModel

logger = logging.getLogger("CollectionScheduler")

TICK_SECONDS = 15


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _aware(dt: datetime.datetime) -> datetime.datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt


def scheduler_enabled() -> bool:
    return os.getenv("COLLECTION_SCHEDULER_ENABLED", "true").lower() in ("1", "true", "yes")


def run_due_collections() -> Optional[dict]:
    """Run fleet discovery if any enabled schedule interval has elapsed."""
    db = SessionLocal()
    try:
        schedules = (
            db.query(CollectionScheduleModel)
            .filter(CollectionScheduleModel.enabled.is_(True))
            .all()
        )
        if not schedules:
            return None

        now = _utcnow()
        due = any(
            s.last_run is None
            or (now - _aware(s.last_run)).total_seconds() >= s.interval_seconds
            for s in schedules
        )
        if not due:
            return None

        result = HardwareDiscoveryEngine.run_auto_discovery(db)
        for s in schedules:
            s.last_run = now
        db.commit()
        return result
    finally:
        db.close()


async def collection_scheduler_loop(stop: asyncio.Event) -> None:
    from app.scheduling.neutral_driver import run_driver_tick

    while not stop.is_set():
        try:
            await asyncio.to_thread(run_driver_tick)
        except Exception:
            logger.exception("Collection scheduler tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=TICK_SECONDS)
            return
        except asyncio.TimeoutError:
            continue
