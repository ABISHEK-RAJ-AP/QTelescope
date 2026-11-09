"""Lab synthetic reachability probes (v1 — DB ping only)."""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import text


def run_lab_probes() -> List[Dict[str, Any]]:
    """ponytail: invoked from platform-health poll, not external cron."""
    out: List[Dict[str, Any]] = []
    t0 = time.perf_counter()
    try:
        from app.core.database import SessionLocal

        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        ms = round((time.perf_counter() - t0) * 1000, 2)
        out.append(
            {
                "probe_id": "database_select1",
                "name": "Database SELECT 1",
                "status": "OK",
                "latency_ms": ms,
                "target": "app database",
                "measured_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as exc:
        ms = round((time.perf_counter() - t0) * 1000, 2)
        out.append(
            {
                "probe_id": "database_select1",
                "name": "Database SELECT 1",
                "status": "FAIL",
                "latency_ms": ms,
                "target": "app database",
                "error": str(exc)[:200],
                "measured_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    return out
