from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.metrics.capabilities import provider_capability_matrix
from app.metrics.coverage import backend_metric_coverage
from app.metrics.coverage_export import coverage_export_csv, coverage_export_payload
from app.metrics.registry import list_metrics, list_registry_groups
from app.models.entities import BackendModel

router = APIRouter(prefix="/metrics", tags=["Metrics Registry"])


@router.get("/registry")
def get_metric_registry():
    groups = list_registry_groups()
    return {
        "metrics": list_metrics(),
        "groups": groups,
        "count": len(list_metrics()),
    }


@router.get("/capabilities")
def get_provider_capabilities():
    return {"providers": provider_capability_matrix()}


@router.get("/coverage")
def get_fleet_coverage(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    return {"backends": [backend_metric_coverage(db, b.backend_id) for b in backends]}


@router.get("/coverage/export")
def export_fleet_coverage(
    db: Session = Depends(get_db),
    format: Literal["csv", "json"] = Query("csv", alias="format"),
):
    if format == "json":
        payload = coverage_export_payload(db)
        payload["row_count"] = len(payload["rows"])
        return payload
    body = coverage_export_csv(db)
    return PlainTextResponse(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="metrics-coverage.csv"'},
    )


@router.get("/coverage/{backend_id}")
def get_backend_coverage(backend_id: str, db: Session = Depends(get_db)):
    return backend_metric_coverage(db, backend_id)
