"""Inventory, provider manifests, dispatch eligibility (approval + manifest + daily shot quota)."""
from __future__ import annotations

import csv
import io
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.development import InventoryAssetModel, ProviderManifestModel, WorkloadSubmissionModel
from app.models.entities import BackendModel, ProviderModel
from app.services.tenant_quota import evaluate_workload_quota


ASSET_LIFECYCLE_TRANSITIONS: Dict[str, frozenset] = {
    "registered": frozenset({"active", "retired"}),
    "active": frozenset({"maintenance", "suspended", "retired"}),
    "maintenance": frozenset({"active", "suspended"}),
    "suspended": frozenset({"active", "retired"}),
    "retired": frozenset(),
}


class CapacityError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def hardware_block_reason(db: Session, backend_id: str) -> Optional[str]:
    backend = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not backend:
        return "backend_missing"
    provider = db.query(ProviderModel).filter(ProviderModel.provider_id == backend.provider_id).first()
    if provider and (provider.status or "") == "suspended":
        return "provider_suspended"
    manifest = (
        db.query(ProviderManifestModel)
        .filter(ProviderManifestModel.provider_id == backend.provider_id)
        .order_by(ProviderManifestModel.created_at.desc())
        .first()
    )
    ops = list(manifest.operations_json or []) if manifest else []
    if "submit" not in ops:
        return "operation_not_declared"
    return None


def _latest_submission(db: Session, tenant_id: str, workload_id: str) -> Optional[WorkloadSubmissionModel]:
    return (
        db.query(WorkloadSubmissionModel)
        .filter(WorkloadSubmissionModel.tenant_id == tenant_id, WorkloadSubmissionModel.workload_id == workload_id)
        .order_by(WorkloadSubmissionModel.created_at.desc())
        .first()
    )


def authorize_dispatch(
    db: Session,
    *,
    tenant_id: str,
    workload_id: str,
    execution_class: str,
    backend_id: Optional[str],
) -> Dict[str, Any]:
    sub = _latest_submission(db, tenant_id, workload_id)
    if not sub:
        raise CapacityError(404, "Workload submission not found")
    reasons: List[str] = []
    if sub.governance_state != "approved":
        reasons.append("approval_not_approved")
    if execution_class == "hardware":
        if not backend_id:
            reasons.append("backend_required")
        else:
            block = hardware_block_reason(db, backend_id)
            if block:
                reasons.append(block)
    quota = evaluate_workload_quota(
        db, tenant_id, workload_id=workload_id, project_id=sub.project_id
    )
    if not quota["allowed"]:
        reasons.append("quota_fail")
    return {
        "eligible": not reasons,
        "reasons": reasons,
        "governance_state": sub.governance_state,
        "quota": {
            "allowed": quota["allowed"],
            "requested_shots": quota["requested_shots"],
            "remaining_shots": quota["remaining_shots"],
            "daily_shots_cap": quota["daily_shots_cap"],
            "window": quota["window"],
            "reason_code": quota["reason_code"],
        },
    }


def create_asset(db: Session, *, commit: bool = True, **fields: Any) -> InventoryAssetModel:
    if fields["execution_class"] not in ("simulated", "hardware"):
        raise CapacityError(422, "execution_class must be simulated or hardware")
    exists = (
        db.query(InventoryAssetModel)
        .filter(
            InventoryAssetModel.provider_id == fields["provider_id"],
            InventoryAssetModel.native_asset_id == fields["native_asset_id"],
        )
        .first()
    )
    if exists:
        raise CapacityError(409, "Duplicate native asset id for provider")
    fields.setdefault("lifecycle_state", "registered")
    row = InventoryAssetModel(asset_id=str(uuid.uuid4()), **fields)
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return row


def import_assets_csv(db: Session, tenant_id: str, provider_id: str, csv_text: str) -> Dict[str, Any]:
    reader = csv.DictReader(io.StringIO(csv_text))
    errors: List[Dict[str, Any]] = []
    parsed: List[Dict[str, str]] = []
    seen = set()
    for index, raw in enumerate(reader, start=2):
        native = (raw.get("native_asset_id") or "").strip()
        asset_class = (raw.get("asset_class") or "").strip()
        execution_class = (raw.get("execution_class") or "").strip()
        if not native or not asset_class or execution_class not in ("simulated", "hardware"):
            errors.append({"row": index, "detail": "native_asset_id, asset_class, and execution_class are required"})
            continue
        if native in seen:
            errors.append({"row": index, "detail": "Duplicate native_asset_id in file"})
        seen.add(native)
        parsed.append({"native_asset_id": native, "asset_class": asset_class, "execution_class": execution_class})
    if errors:
        return {"committed": False, "created": 0, "errors": errors}
    created = []
    try:
        for item in parsed:
            created.append(
                create_asset(
                    db,
                    commit=False,
                    tenant_id=tenant_id,
                    provider_id=provider_id,
                    provenance="csv",
                    **item,
                )
            )
        db.commit()
    except CapacityError as exc:
        db.rollback()
        return {"committed": False, "created": 0, "errors": [{"row": None, "detail": exc.detail}]}
    return {"committed": True, "created": len(created), "errors": []}


def transition_asset_lifecycle(
    db: Session,
    *,
    tenant_id: str,
    asset_id: str,
    lifecycle_state: str,
) -> InventoryAssetModel:
    row = (
        db.query(InventoryAssetModel)
        .filter(InventoryAssetModel.tenant_id == tenant_id, InventoryAssetModel.asset_id == asset_id)
        .first()
    )
    if not row:
        raise CapacityError(404, "Asset not found")
    current = (row.lifecycle_state or "registered").lower()
    target = lifecycle_state.lower()
    allowed = ASSET_LIFECYCLE_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise CapacityError(409, f"Invalid lifecycle transition {current} → {target}")
    row.lifecycle_state = target
    db.commit()
    db.refresh(row)
    return row
