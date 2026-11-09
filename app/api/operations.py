"""Operations Centre aggregate API."""
from __future__ import annotations

import time
from datetime import datetime, timezone

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.provenance import database_storage_mode, platform_data_mode, MOCK_BACKEND_IDS
from app.discovery.hardware_discovery import ensure_discovered
from sqlalchemy import text

from app.models.entities import AlertModel, BackendModel, BackendTelemetryModel, IncidentModel
from app.services.collector_health import list_provider_health
from app.services.collector_dlq import list_failures as list_collector_dlq
from app.services.circuit_breaker import snapshot as circuit_snapshot
from app.services.incident_service import sync_incidents_from_alerts_if_stale
from app.infra.classical_metrics import list_classical_infra
from app.core.cache import cache_health as _cache_health

router = APIRouter(prefix="/operations", tags=["Operations Centre"])


def _alert_backend_id(alert: AlertModel) -> str | None:
    res_id = alert.resource_id or ""
    if not res_id:
        return None
    if "_Q" in res_id:
        return res_id.rsplit("_Q", 1)[0]
    return res_id


@router.get("/centre")
def get_operations_centre(db: Session = Depends(get_db)):
    ensure_discovered(db)
    try:
        sync_incidents_from_alerts_if_stale(db)
    except Exception:
        db.rollback()

    backends = []
    open_incidents = []
    active_alerts = 0
    try:
        backends = db.query(BackendModel).all()
        open_incidents = (
            db.query(IncidentModel)
            .filter(IncidentModel.status.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"]))
            .order_by(IncidentModel.last_detected_at.desc())
            .limit(10)
            .all()
        )
        active_alerts = db.query(AlertModel).filter(AlertModel.status == "ACTIVE").count()
    except Exception:
        db.rollback()
    online = sum(1 for b in backends if b.operational_status == "ONLINE")
    offline = sum(1 for b in backends if b.operational_status == "OFFLINE")
    maintenance = sum(1 for b in backends if b.operational_status not in ("ONLINE", "OFFLINE"))
    collectors = list_provider_health()
    collector_fail = sum(1 for c in collectors if c.get("status") not in ("OK", None))

    live_backends = [b for b in backends if b.backend_id not in MOCK_BACKEND_IDS]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fleet": {
            "total": len(backends),
            "online": online,
            "offline": offline,
            "maintenance_or_other": maintenance,
            "simulated_catalog": sum(1 for b in backends if b.backend_id in MOCK_BACKEND_IDS),
        },
        "data_platform": {
            "enable_mock_data": settings.ENABLE_MOCK_DATA,
            "database_storage": database_storage_mode(settings.DATABASE_URL),
            "platform_data_mode": platform_data_mode(settings.ENABLE_MOCK_DATA, bool(live_backends)),
        },
        "collectors": {
            "providers": collectors,
            "failed_or_stale": collector_fail,
        },
        "operations": {
            "active_alerts": active_alerts,
            "open_incidents": len(open_incidents),
        },
        "classical_hpc": list_classical_infra(db),
        "incidents": [
            {
                "incident_id": i.incident_id,
                "title": i.title,
                "backend_id": i.backend_id,
                "severity": i.severity,
                "status": i.status,
                "last_detected_at": i.last_detected_at.isoformat() if i.last_detected_at else None,
            }
            for i in open_incidents
        ],
        "backends_snapshot": [
            {
                "backend_id": b.backend_id,
                "backend_name": b.backend_name,
                "operational_status": b.operational_status,
                "qpu_modality": b.qpu_modality,
                "provider_id": b.provider_id,
            }
            for b in backends
        ],
    }


def _build_platform_health(db: Session) -> Dict[str, Any]:
    """Self-observability: DB, collectors, SSE honesty, collection freshness."""
    ensure_discovered(db)
    db_ok = True
    db_error = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # ponytail: single probe, surface error text
        db_ok = False
        db_error = str(exc)[:200]

    collectors = list_provider_health()
    failed = [c for c in collectors if c.get("status") not in ("OK", None, "")]
    latest_bt = None
    live_backends_exist = False
    try:
        latest_bt = (
            db.query(BackendTelemetryModel)
            .order_by(BackendTelemetryModel.timestamp.desc())
            .first()
        )
        live_backends_exist = bool(
            [b for b in db.query(BackendModel).all() if b.backend_id not in MOCK_BACKEND_IDS]
        )
    except Exception as exc:
        db.rollback()
        db_ok = False
        db_error = db_error or str(exc)[:200]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database": {
            "storage": database_storage_mode(settings.DATABASE_URL),
            "reachable": db_ok,
            "error": db_error,
        },
        "cache": _cache_health(),
        "collectors": {
            "providers": collectors,
            "failed_count": len(failed),
            "failed_providers": [c.get("provider_id") for c in failed],
            "dlq_recent_count": len(list_collector_dlq(limit=100)),
            "circuit_breakers_open": [
                pid for pid, st in circuit_snapshot().items() if float(st.get("open_until") or 0) > time.time()
            ],
        },
        "sse_stream": {
            "path": "/api/v1/events/stream",
            "stream_kind": "database_aggregate",
            "note": "UI refresh ticks — not vendor live push",
        },
        "collection_scheduler": {
            "mode": "on_demand",
            "note": "Full cycle via Admin collection trigger; no separate daemon in default dev profile",
        },
        "latest_backend_telemetry_at": latest_bt.timestamp.isoformat()
        if latest_bt and latest_bt.timestamp
        else None,
        "data_platform": {
            "enable_mock_data": settings.ENABLE_MOCK_DATA,
            "platform_data_mode": platform_data_mode(
                settings.ENABLE_MOCK_DATA,
                live_backends_exist,
            ),
        },
        "ingestion_quality_latest": _ingestion_quality_snapshot(),
        "dependency_links": _dependency_snapshot(db),
        "slis": _sli_snapshot(),
        "synthetics": _synthetic_snapshot(),
    }


@router.get("/platform-health")
def get_platform_health(db: Session = Depends(get_db)):
    from app.core.cache import cache_key, default_ttl, get_or_set_json

    ttl = default_ttl("platform_health", 12)
    key = cache_key("operations", "platform-health")
    return get_or_set_json(key, ttl, lambda: _build_platform_health(db))


def _synthetic_snapshot() -> List[Dict[str, Any]]:
    try:
        from app.services.synthetic_probe import run_lab_probes

        return run_lab_probes()
    except Exception:
        return []


def _sli_snapshot() -> List[Dict[str, Any]]:
    try:
        from app.services.sli_measurements import latest_slis_for_ui

        return latest_slis_for_ui()
    except Exception:
        return []


def _ingestion_quality_snapshot() -> List[Dict[str, Any]]:
    try:
        from app.services.ingestion_quality import latest_by_provider

        return latest_by_provider()
    except Exception:
        return []


def _dependency_snapshot(db: Session) -> List[Dict[str, Any]]:
    """Provider → backend → active alert count (real FK relationships)."""
    try:
        from app.models.entities import AlertModel, BackendModel

        backends = db.query(BackendModel).all()
        alert_counts: Dict[str, int] = {}
        for a in db.query(AlertModel).filter(AlertModel.status == "ACTIVE").all():
            if a.resource_type == "BACKEND" and a.resource_id:
                alert_counts[a.resource_id] = alert_counts.get(a.resource_id, 0) + 1
        by_provider: Dict[str, List[Dict[str, Any]]] = {}
        for b in backends:
            by_provider.setdefault(b.provider_id, []).append(
                {
                    "backend_id": b.backend_id,
                    "backend_name": b.backend_name,
                    "operational_status": b.operational_status,
                    "active_alerts": alert_counts.get(b.backend_id, 0),
                }
            )
        collectors = list_provider_health()
        coll_map = {c.get("provider_id"): c for c in collectors}
        out = []
        for pid, bes in by_provider.items():
            out.append(
                {
                    "provider_id": pid,
                    "collector_status": (coll_map.get(pid) or {}).get("status"),
                    "last_run_at": (coll_map.get(pid) or {}).get("last_run_at"),
                    "backends": bes,
                }
            )
        return out
    except Exception:
        return []


@router.get("/timeline")
def get_operations_timeline(
    limit: int = 40,
    db: Session = Depends(get_db),
):
    """Merged alerts, incidents, and collector failures for ops correlation."""
    try:
        sync_incidents_from_alerts_if_stale(db)
    except Exception:
        db.rollback()
    events = []

    for a in (
        db.query(AlertModel)
        .order_by(AlertModel.detected_at.desc())
        .limit(limit)
        .all()
    ):
        events.append(
            {
                "kind": "alert",
                "id": a.alert_id,
                "severity": a.severity,
                "title": a.message or a.alert_type,
                "backend_id": _alert_backend_id(a),
                "status": a.status,
                "at": a.detected_at.isoformat() if a.detected_at else None,
                "correlation_id": a.alert_id,
            }
        )

    for inc in (
        db.query(IncidentModel)
        .order_by(IncidentModel.last_detected_at.desc())
        .limit(limit)
        .all()
    ):
        events.append(
            {
                "kind": "incident",
                "id": inc.incident_id,
                "severity": inc.severity,
                "title": inc.title,
                "backend_id": inc.backend_id,
                "status": inc.status,
                "at": inc.last_detected_at.isoformat() if inc.last_detected_at else None,
                "correlation_id": inc.incident_id,
            }
        )

    for c in list_provider_health():
        if c.get("status") in ("OK", None, ""):
            continue
        events.append(
            {
                "kind": "collector_failure",
                "id": c.get("provider_id"),
                "severity": "WARNING",
                "title": f"Collector {c.get('provider_id')}: {c.get('status')}",
                "backend_id": None,
                "status": c.get("status"),
                "at": c.get("last_run_at") or datetime.now(timezone.utc).isoformat(),
                "correlation_id": c.get("provider_id"),
            }
        )

    events.sort(key=lambda e: e.get("at") or "", reverse=True)
    return {"events": events[:limit], "count": min(len(events), limit)}
