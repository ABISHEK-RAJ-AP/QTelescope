"""Draft resource offerings derived from inventory — synthetic catalog v1 (not a persisted entity)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.development import InventoryAssetModel
from app.models.entities import ProviderModel

SYNTHETIC_PREFIX = "synthetic:"


def _offering_id(asset_id: str) -> str:
    return f"{SYNTHETIC_PREFIX}{asset_id}"


def list_draft_offerings(db: Session, tenant_id: str, *, limit: int = 200) -> Dict[str, Any]:
    assets = (
        db.query(InventoryAssetModel)
        .filter(InventoryAssetModel.tenant_id == tenant_id)
        .order_by(InventoryAssetModel.created_at.desc())
        .limit(limit)
        .all()
    )
    provider_ids = {a.provider_id for a in assets if a.provider_id}
    providers: Dict[str, ProviderModel] = {}
    if provider_ids:
        for p in db.query(ProviderModel).filter(ProviderModel.provider_id.in_(provider_ids)):
            providers[p.provider_id] = p

    items: List[Dict[str, Any]] = []
    for a in assets:
        prov = providers.get(a.provider_id or "")
        pname = (prov.provider_name if prov else None) or a.provider_id or "provider"
        items.append(
            {
                "offering_id": _offering_id(a.asset_id),
                "synthetic": True,
                "status": "draft",
                "title": f"{a.asset_class} · {pname}",
                "provider_id": a.provider_id,
                "asset_id": a.asset_id,
                "execution_class": a.execution_class,
                "asset_class": a.asset_class,
                "lifecycle_state": a.lifecycle_state or "registered",
                "capability_ref": a.native_asset_id,
            }
        )
    return {
        "items": items,
        "count": len(items),
        "synthetic": True,
        "source": "inventory_assets",
        "tenant_id": tenant_id,
    }


def get_draft_offering(db: Session, tenant_id: str, offering_id: str) -> Optional[Dict[str, Any]]:
    if not offering_id.startswith(SYNTHETIC_PREFIX):
        return None
    asset_id = offering_id[len(SYNTHETIC_PREFIX) :]
    row = (
        db.query(InventoryAssetModel)
        .filter(InventoryAssetModel.tenant_id == tenant_id, InventoryAssetModel.asset_id == asset_id)
        .first()
    )
    if not row:
        return None
    prov = db.query(ProviderModel).filter(ProviderModel.provider_id == row.provider_id).first()
    pname = (prov.provider_name if prov else None) or row.provider_id or "provider"
    return {
        "offering_id": offering_id,
        "synthetic": True,
        "status": "draft",
        "title": f"{row.asset_class} · {pname}",
        "provider_id": row.provider_id,
        "asset_id": row.asset_id,
        "execution_class": row.execution_class,
        "asset_class": row.asset_class,
        "lifecycle_state": row.lifecycle_state or "registered",
        "capability_ref": row.native_asset_id,
        "provenance": row.provenance,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "source": "inventory_assets",
        "tenant_id": tenant_id,
    }