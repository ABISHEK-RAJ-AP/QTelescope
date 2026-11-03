"""Honest provider connector posture for Govern (S8 read-only)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.discovery.hardware_discovery import ensure_discovered
from app.models.development import DispatchAttemptModel, ProviderManifestModel
from app.models.entities import BackendModel, ProviderModel
from app.services.circuit_breaker import is_open
from app.services.collector_health import load_all as load_collector_health


def _provider_has_reconciled_dispatch(db: Session, provider_id: str) -> bool:
    backend_ids = [
        b[0]
        for b in db.query(BackendModel.backend_id).filter(BackendModel.provider_id == provider_id).limit(500).all()
    ]
    if not backend_ids:
        return False
    return (
        db.query(DispatchAttemptModel.attempt_id)
        .filter(
            DispatchAttemptModel.backend_id.in_(backend_ids),
            DispatchAttemptModel.dispatch_state == "dispatch_confirmed",
            DispatchAttemptModel.external_job_id.isnot(None),
        )
        .first()
        is not None
    )


def _integration_stage(
    db: Session,
    *,
    provider_id: str,
    manifest: Optional[ProviderManifestModel],
    health: Optional[Dict[str, Any]],
    provider_status: str,
) -> str:
    if (provider_status or "") == "suspended":
        return "suspended"
    if not manifest:
        return "I1"
    ops = list(manifest.operations_json or [])
    if health and health.get("last_run_at"):
        if "submit" in ops:
            if _provider_has_reconciled_dispatch(db, provider_id):
                return "I5"
            return "I4"
        return "I3"
    return "I2"


def provider_catalog_items(db: Session) -> List[Dict[str, Any]]:
    ensure_discovered(db)
    health_by_id = load_collector_health().get("providers") or {}
    rows = db.query(ProviderModel).order_by(ProviderModel.provider_name).limit(200).all()
    items: List[Dict[str, Any]] = []
    for p in rows:
        manifest = (
            db.query(ProviderManifestModel)
            .filter(ProviderManifestModel.provider_id == p.provider_id)
            .order_by(ProviderManifestModel.created_at.desc())
            .first()
        )
        health = health_by_id.get(p.provider_id)
        stage = _integration_stage(
            db,
            provider_id=p.provider_id,
            manifest=manifest,
            health=health,
            provider_status=p.status or "active",
        )
        items.append(
            {
                "provider_id": p.provider_id,
                "provider_name": p.provider_name,
                "status": p.status,
                "integration": {
                    "manifest_registered": manifest is not None,
                    "operations": list(manifest.operations_json or []) if manifest else [],
                    "stage": stage,
                    "collector_last_status": health.get("status") if health else None,
                    "collector_last_run_at": health.get("last_run_at") if health else None,
                    "collector_backends_detected": health.get("backends_detected") if health else None,
                    "circuit_open": is_open(p.provider_id),
                },
            }
        )
    return items
