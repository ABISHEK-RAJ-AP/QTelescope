from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.metrics.capabilities import provider_capability_matrix
from app.metrics.coverage import backend_metric_coverage
from app.metrics.registry import list_metrics
from app.models.entities import BackendModel

router = APIRouter(prefix="/metrics", tags=["Metrics Registry"])


@router.get("/registry")
def get_metric_registry():
    return {"metrics": list_metrics(), "count": len(list_metrics())}


@router.get("/capabilities")
def get_provider_capabilities():
    return {"providers": provider_capability_matrix()}


@router.get("/coverage")
def get_fleet_coverage(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).all()
    return {"backends": [backend_metric_coverage(db, b.backend_id) for b in backends]}


@router.get("/coverage/{backend_id}")
def get_backend_coverage(backend_id: str, db: Session = Depends(get_db)):
    return backend_metric_coverage(db, backend_id)
