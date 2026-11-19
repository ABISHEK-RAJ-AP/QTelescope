"""One-shot diet for lab VMs: keep enough telemetry for UI flows, drop migration bloat."""
from __future__ import annotations

import os
from typing import Any, Dict, List

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.jobs.telemetry_retention import run_telemetry_retention
from app.models.entities import BackendTelemetryModel, GateTelemetryModel, QubitTelemetryModel


def demo_trim_policy() -> Dict[str, Any]:
    days = int(os.getenv("DEMO_RETENTION_DAYS", os.getenv("TELEMETRY_RETENTION_DAYS", "14")))
    days = max(3, min(days, 90))
    cap = int(os.getenv("DEMO_TELEMETRY_CAP_PER_BACKEND", "2500"))
    cap = max(200, min(cap, 50000))
    bt_cap = int(os.getenv("DEMO_BACKEND_TELEMETRY_CAP", "400"))
    bt_cap = max(50, min(bt_cap, 10000))
    return {
        "retention_days": days,
        "max_rows_per_backend": cap,
        "backend_telemetry_cap_per_backend": bt_cap,
        "targets": ["gate_telemetry", "qubit_telemetry", "backend_telemetry"],
    }


def _table_counts(db: Session) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for name, model in (
        ("gate_telemetry", GateTelemetryModel),
        ("qubit_telemetry", QubitTelemetryModel),
        ("backend_telemetry", BackendTelemetryModel),
    ):
        out[name] = int(db.query(func.count(model.id)).scalar() or 0)
    return out


def _cap_table_per_backend(db: Session, table: str, cap: int) -> int:
    """Delete rows beyond the newest `cap` per backend_id (window rank)."""
    if cap <= 0:
        return 0
    sql = text(
        f"""
        DELETE FROM {table} AS t
        WHERE t.id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY backend_id ORDER BY timestamp DESC, id DESC
                       ) AS rn
                FROM {table}
            ) ranked
            WHERE ranked.rn > :cap
        )
        """
    )
    result = db.execute(sql, {"cap": cap})
    db.commit()
    return int(result.rowcount or 0)


def run_demo_telemetry_trim(db: Session) -> Dict[str, Any]:
    """
    Phase 1: drop older than retention_days.
    Phase 2: cap newest N rows per backend (stops multi-million gate/qubit history).
  Keeps backends, alerts, incidents, jobs — demo flows stay intact.
    """
    policy = demo_trim_policy()
    before = _table_counts(db)

    by_age = run_telemetry_retention(db, days=policy["retention_days"])

    cap_gate = _cap_table_per_backend(db, "gate_telemetry", policy["max_rows_per_backend"])
    cap_qubit = _cap_table_per_backend(db, "qubit_telemetry", policy["max_rows_per_backend"])
    cap_bt = _cap_table_per_backend(db, "backend_telemetry", policy["backend_telemetry_cap_per_backend"])

    after = _table_counts(db)
    try:
        from app.core.cache import invalidate_operational_cache

        invalidate_operational_cache()
    except Exception:
        pass

    return {
        "policy": policy,
        "counts_before": before,
        "deleted_older_than_retention": by_age,
        "deleted_by_cap": {
            "gate_telemetry": cap_gate,
            "qubit_telemetry": cap_qubit,
            "backend_telemetry": cap_bt,
        },
        "counts_after": after,
        "total_telemetry_after": sum(after.values()),
    }


def format_trim_report(report: Dict[str, Any]) -> List[str]:
    lines = [
        f"retention_days={report['policy']['retention_days']}, "
        f"cap_per_backend={report['policy']['max_rows_per_backend']}",
        f"before: gate={report['counts_before']['gate_telemetry']:,} "
        f"qubit={report['counts_before']['qubit_telemetry']:,} "
        f"backend={report['counts_before']['backend_telemetry']:,}",
        f"after:  gate={report['counts_after']['gate_telemetry']:,} "
        f"qubit={report['counts_after']['qubit_telemetry']:,} "
        f"backend={report['counts_after']['backend_telemetry']:,} "
        f"(total {report['total_telemetry_after']:,})",
    ]
    return lines