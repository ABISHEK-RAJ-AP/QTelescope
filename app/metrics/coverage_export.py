"""Flatten fleet coverage for CSV/JSON export."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.metrics.coverage import backend_metric_coverage
from app.models.entities import BackendModel


def fleet_coverage_rows(db: Session) -> List[Dict[str, Any]]:
    backends = db.query(BackendModel).order_by(BackendModel.backend_id.asc()).all()
    rows: List[Dict[str, Any]] = []
    for b in backends:
        cov = backend_metric_coverage(db, b.backend_id)
        for m in cov.get("metrics") or []:
            rows.append(
                {
                    "backend_id": cov.get("backend_id"),
                    "backend_name": cov.get("backend_name"),
                    "provider_id": cov.get("provider_id"),
                    "qpu_modality": cov.get("qpu_modality"),
                    "metric_id": m.get("metric_id"),
                    "metric_name": m.get("name"),
                    "unit": m.get("unit"),
                    "scope": m.get("scope"),
                    "group": m.get("group") or "",
                    "state": m.get("state"),
                }
            )
    return rows


def coverage_export_payload(db: Session) -> Dict[str, Any]:
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "row_count": 0,  # filled by caller
        "rows": fleet_coverage_rows(db),
    }


def coverage_export_csv(db: Session) -> str:
    rows = fleet_coverage_rows(db)
    buf = io.StringIO()
    fieldnames = [
        "backend_id",
        "backend_name",
        "provider_id",
        "qpu_modality",
        "metric_id",
        "metric_name",
        "unit",
        "scope",
        "group",
        "state",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()