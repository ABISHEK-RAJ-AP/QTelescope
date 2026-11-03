"""Virtual pools and compatibility evaluation (S5). Each asset stays a distinct hardware boundary."""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.development import (
    InventoryAssetModel,
    VirtualResourcePoolMemberModel,
    VirtualResourcePoolModel,
)
from app.models.entities import ProviderModel
from app.services.governance_capacity import CapacityError


def evaluate_resource_compatibility(
    db: Session,
    *,
    tenant_id: str,
    asset_id: str,
    execution_class: Optional[str] = None,
    asset_class: Optional[str] = None,
    lifecycle_states: Optional[List[str]] = None,
) -> Dict[str, Any]:
    row = (
        db.query(InventoryAssetModel)
        .filter(InventoryAssetModel.tenant_id == tenant_id, InventoryAssetModel.asset_id == asset_id)
        .first()
    )
    if not row:
        return {
            "eligible": False,
            "asset_id": asset_id,
            "reason_codes": ["ASSET_NOT_FOUND"],
            "resource": None,
        }
    allowed_lifecycle = lifecycle_states or ["active", "registered"]
    reason_codes: List[str] = []
    if execution_class and row.execution_class != execution_class:
        reason_codes.append("EXECUTION_CLASS_MISMATCH")
    if asset_class and row.asset_class.lower() != asset_class.lower():
        reason_codes.append("ASSET_CLASS_MISMATCH")
    state = (row.lifecycle_state or "registered").lower()
    if state not in {s.lower() for s in allowed_lifecycle}:
        reason_codes.append("LIFECYCLE_NOT_ELIGIBLE")
    if row.execution_class == "hardware":
        provider = db.query(ProviderModel).filter(ProviderModel.provider_id == row.provider_id).first()
        if provider and (provider.status or "") == "suspended":
            reason_codes.append("PROVIDER_SUSPENDED")
    return {
        "eligible": not reason_codes,
        "asset_id": asset_id,
        "reason_codes": reason_codes,
        "resource": {
            "asset_id": row.asset_id,
            "native_asset_id": row.native_asset_id,
            "provider_id": row.provider_id,
            "execution_class": row.execution_class,
            "asset_class": row.asset_class,
            "lifecycle_state": state,
        },
    }


def create_pool(db: Session, *, tenant_id: str, name: str, description: Optional[str] = None) -> VirtualResourcePoolModel:
    name = name.strip()
    if not name:
        raise CapacityError(422, "Pool name is required")
    row = VirtualResourcePoolModel(
        pool_id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        name=name,
        description=(description or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def add_pool_member(db: Session, *, tenant_id: str, pool_id: str, asset_id: str) -> VirtualResourcePoolMemberModel:
    pool = (
        db.query(VirtualResourcePoolModel)
        .filter(VirtualResourcePoolModel.tenant_id == tenant_id, VirtualResourcePoolModel.pool_id == pool_id)
        .first()
    )
    if not pool:
        raise CapacityError(404, "Pool not found")
    asset = (
        db.query(InventoryAssetModel)
        .filter(InventoryAssetModel.tenant_id == tenant_id, InventoryAssetModel.asset_id == asset_id)
        .first()
    )
    if not asset:
        raise CapacityError(404, "Asset not found")
    exists = (
        db.query(VirtualResourcePoolMemberModel)
        .filter(VirtualResourcePoolMemberModel.pool_id == pool_id, VirtualResourcePoolMemberModel.asset_id == asset_id)
        .first()
    )
    if exists:
        raise CapacityError(409, "Asset already in pool")
    member = VirtualResourcePoolMemberModel(pool_id=pool_id, asset_id=asset_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def pool_to_dict(db: Session, pool: VirtualResourcePoolModel) -> Dict[str, Any]:
    members = db.query(VirtualResourcePoolMemberModel).filter(VirtualResourcePoolMemberModel.pool_id == pool.pool_id).all()
    asset_ids = [m.asset_id for m in members]
    assets = []
    if asset_ids:
        rows = (
            db.query(InventoryAssetModel)
            .filter(InventoryAssetModel.tenant_id == pool.tenant_id, InventoryAssetModel.asset_id.in_(asset_ids))
            .all()
        )
        by_id = {r.asset_id: r for r in rows}
        for aid in asset_ids:
            r = by_id.get(aid)
            if r:
                assets.append(
                    {
                        "asset_id": r.asset_id,
                        "native_asset_id": r.native_asset_id,
                        "execution_class": r.execution_class,
                        "lifecycle_state": r.lifecycle_state or "registered",
                    }
                )
    return {
        "pool_id": pool.pool_id,
        "name": pool.name,
        "description": pool.description,
        "member_count": len(members),
        "members": assets,
        "created_at": pool.created_at.isoformat() if pool.created_at else None,
    }
