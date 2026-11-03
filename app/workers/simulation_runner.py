"""Background simulation worker — queued → running → completed/failed."""
from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.core.database import SessionLocal
from app.services import development_service as dev_svc

logger = logging.getLogger("SimulationRunner")

_EXECUTOR: Optional[ThreadPoolExecutor] = None


def simulation_async_enabled() -> bool:
    return os.getenv("SIMULATION_ASYNC", "false").lower().strip() in ("1", "true", "yes")


def runner_enabled() -> bool:
    return os.getenv("SIMULATION_RUNNER_ENABLED", "true").lower().strip() in ("1", "true", "yes")


def _process(job_id: str) -> None:
    db = SessionLocal()
    try:
        dev_svc.process_simulation_job(db, job_id)
    except Exception:
        logger.exception("Simulation job %s failed in worker", job_id)
    finally:
        db.close()


def start_simulation_runner() -> None:
    global _EXECUTOR
    if not runner_enabled() or _EXECUTOR is not None:
        return
    workers = max(1, int(os.getenv("SIMULATION_WORKER_THREADS", "2")))
    _EXECUTOR = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="sim-worker")
    logger.info("Simulation runner started (%s threads)", workers)


def stop_simulation_runner() -> None:
    global _EXECUTOR
    if _EXECUTOR is not None:
        _EXECUTOR.shutdown(wait=False, cancel_futures=True)
        _EXECUTOR = None


def kick_simulation_job(job_id: str) -> None:
    if not simulation_async_enabled():
        db = SessionLocal()
        try:
            dev_svc.process_simulation_job(db, job_id)
        finally:
            db.close()
        return
    if _EXECUTOR is None:
        start_simulation_runner()
    if _EXECUTOR is not None:
        _EXECUTOR.submit(_process, job_id)
