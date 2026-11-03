"""Connector meter samples — no fabricated counters (REQ-D006)."""
from __future__ import annotations

import csv
import io
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.development import MeterSampleModel

ALLOWED_UNITS = frozenset({"shots", "seconds", "jobs", "percent", "qubits", "count"})


def ingest_meter_sample(
    db: Session,
    *,
    tenant_id: str,
    dimension: str,
    metric: str,
    unit: str,
    value: Optional[float],
    source_time: Optional[datetime],
    connector_id: str,
) -> Dict[str, Any]:
    dim = (dimension or "").strip()
    met = (metric or "").strip()
    if not dim or not met:
        raise ValueError("dimension and metric are required")
    unit_norm = (unit or "").strip().lower()
    available = unit_norm in ALLOWED_UNITS and value is not None
    row = MeterSampleModel(
        sample_id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        dimension=dim,
        metric=met,
        value=float(value) if available else None,
        unit=unit_norm or "unknown",
        availability="available" if available else "unavailable",
        source_time=source_time or datetime.now(timezone.utc),
        connector_id=(connector_id or "unknown").strip() or "unknown",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _sample_out(row)


def list_meter_rollups(
    db: Session,
    *,
    tenant_id: str,
    hours: int = 24,
    dimension: Optional[str] = None,
) -> Dict[str, Any]:
    hours = max(1, min(hours, 24 * 30))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = db.query(MeterSampleModel).filter(
        MeterSampleModel.tenant_id == tenant_id,
        MeterSampleModel.source_time >= since,
    )
    if dimension:
        q = q.filter(MeterSampleModel.dimension == dimension.strip())
    rows = q.order_by(MeterSampleModel.source_time.desc()).limit(5000).all()

    groups: Dict[tuple, Dict[str, Any]] = defaultdict(
        lambda: {
            "dimension": "",
            "metric": "",
            "unit": "",
            "sum_value": 0.0,
            "available_samples": 0,
            "unavailable_samples": 0,
            "latest_source_time": None,
        }
    )
    for r in rows:
        key = (r.dimension, r.metric, r.unit)
        g = groups[key]
        g["dimension"] = r.dimension
        g["metric"] = r.metric
        g["unit"] = r.unit
        if r.availability == "available" and r.value is not None:
            g["sum_value"] += float(r.value)
            g["available_samples"] += 1
        else:
            g["unavailable_samples"] += 1
        ts = r.source_time.isoformat() if r.source_time else None
        if ts and (g["latest_source_time"] is None or ts > g["latest_source_time"]):
            g["latest_source_time"] = ts

    items = sorted(groups.values(), key=lambda x: (x["dimension"], x["metric"]))
    return {
        "window_hours": hours,
        "since": since.isoformat(),
        "items": items,
        "sample_count": len(rows),
    }


def export_meter_rollups_csv(db: Session, *, tenant_id: str, hours: int = 24) -> str:
    body = list_meter_rollups(db, tenant_id=tenant_id, hours=hours)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["dimension", "metric", "unit", "sum_value", "available_samples", "unavailable_samples", "latest_source_time"],
    )
    for row in body["items"]:
        writer.writerow(
            [
                row["dimension"],
                row["metric"],
                row["unit"],
                row["sum_value"],
                row["available_samples"],
                row["unavailable_samples"],
                row["latest_source_time"] or "",
            ],
        )
    return buf.getvalue()


def count_recent_samples(db: Session, *, tenant_id: str, hours: int = 24) -> int:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    return (
        db.query(MeterSampleModel)
        .filter(MeterSampleModel.tenant_id == tenant_id, MeterSampleModel.source_time >= since)
        .count()
    )


def _sample_out(row: MeterSampleModel) -> Dict[str, Any]:
    return {
        "sample_id": row.sample_id,
        "dimension": row.dimension,
        "metric": row.metric,
        "value": row.value,
        "unit": row.unit,
        "availability": row.availability,
        "source_time": row.source_time.isoformat() if row.source_time else None,
        "connector_id": row.connector_id,
    }

