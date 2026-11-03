"""Govern inventory + provider lifecycle. Quota/reservation out of programme scope (OD-QRP-02)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, get_current_username, rbac_enforced
from app.core.tenant import get_current_tenant
from app.models.development import InventoryAssetModel, ProviderManifestModel, WorkloadSubmissionModel
from app.models.entities import ProviderModel
from app.services.approval_fsm import governance_progress, load_approval_policy
from app.services.dispatch_attempt import (
    create_dispatch_attempt,
    get_dispatch_attempt,
    list_dispatch_attempts,
    reconcile_dispatch_attempt,
)
from app.services.resource_virtualization import (
    add_pool_member,
    create_pool,
    evaluate_resource_compatibility,
    pool_to_dict,
)
from app.services.govern_connectors import provider_catalog_items
from app.services.metering import export_meter_rollups_csv, ingest_meter_sample, list_meter_rollups
from app.services.governance_capacity import (
    ASSET_LIFECYCLE_TRANSITIONS,
    CapacityError,
    authorize_dispatch,
    create_asset,
    import_assets_csv,
    transition_asset_lifecycle,
)

router = APIRouter(tags=["governance"])


def _require(perm: str, role: str) -> None:
    if not rbac_enforced():
        return
    if not role_has_permission(role, perm):
        raise HTTPException(status_code=403, detail=f"Permission denied: {perm}")


def _require_any(role: str, *perms: str) -> None:
    if not rbac_enforced():
        return
    if any(role_has_permission(role, p) for p in perms):
        return
    raise HTTPException(status_code=403, detail=f"Permission denied: one of {', '.join(perms)}")


def _raise(exc: CapacityError) -> None:
    raise HTTPException(status_code=exc.status, detail=exc.detail) from exc


class AssetIn(BaseModel):
    provider_id: str
    native_asset_id: str
    asset_class: str
    execution_class: Literal["simulated", "hardware"]


class ImportIn(BaseModel):
    provider_id: str
    csv_text: str


class ManifestIn(BaseModel):
    operations: List[str]
    execution_classes: List[str] = ["hardware"]


class ProviderTransitionIn(BaseModel):
    status: Literal["active", "suspended"]


class AssetLifecycleIn(BaseModel):
    lifecycle_state: Literal["active", "maintenance", "suspended", "retired"]


class AuthorizeIn(BaseModel):
    execution_class: Literal["simulated", "hardware"]
    backend_id: str | None = None


class DispatchAttemptIn(BaseModel):
    idempotency_key: str
    execution_class: Literal["simulated", "hardware"]
    backend_id: str | None = None


class ReconcileIn(BaseModel):
    outcome: Literal["confirmed", "failed", "unresolved"]
    external_job_id: str | None = None
    reason: str | None = None
    connector_icd_version: str | None = Field(default="manual-v1", max_length=64)


class MeterSampleIn(BaseModel):
    dimension: str = Field(min_length=1, max_length=256)
    metric: str = Field(min_length=1, max_length=128)
    unit: str = Field(min_length=1, max_length=64)
    value: float | None = None
    source_time: datetime | None = None
    connector_id: str = Field(default="connector", max_length=128)


class DryRunIn(BaseModel):
    workload_id: str


class PoolIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class PoolMemberIn(BaseModel):
    asset_id: str


class CompatibilityIn(BaseModel):
    asset_id: str
    execution_class: Literal["simulated", "hardware"] | None = None
    asset_class: str | None = None
    lifecycle_states: List[str] | None = None


@router.post("/inventory/assets")
def add_asset(
    body: AssetIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:import", role)
    try:
        row = create_asset(db, tenant_id=tenant_id, provenance="manual", **body.model_dump())
    except CapacityError as exc:
        _raise(exc)
    return {"asset_id": row.asset_id, "execution_class": row.execution_class, "lifecycle_state": row.lifecycle_state}


def _asset_out(r: InventoryAssetModel) -> dict:
    return {
        "asset_id": r.asset_id,
        "provider_id": r.provider_id,
        "native_asset_id": r.native_asset_id,
        "asset_class": r.asset_class,
        "execution_class": r.execution_class,
        "provenance": r.provenance,
        "lifecycle_state": r.lifecycle_state or "registered",
        "allowed_transitions": sorted(ASSET_LIFECYCLE_TRANSITIONS.get(r.lifecycle_state or "registered", frozenset())),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/inventory/assets")
def list_assets(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    provider_id: str | None = Query(None),
    execution_class: Literal["simulated", "hardware"] | None = Query(None),
    asset_class: str | None = Query(None),
    lifecycle_state: str | None = Query(None),
):
    _require("inventory:read", role)
    q = db.query(InventoryAssetModel).filter(InventoryAssetModel.tenant_id == tenant_id)
    if provider_id:
        q = q.filter(InventoryAssetModel.provider_id == provider_id)
    if execution_class:
        q = q.filter(InventoryAssetModel.execution_class == execution_class)
    if asset_class:
        q = q.filter(func.lower(InventoryAssetModel.asset_class) == asset_class.lower())
    if lifecycle_state:
        q = q.filter(InventoryAssetModel.lifecycle_state == lifecycle_state)
    rows = q.order_by(InventoryAssetModel.created_at.desc()).limit(200).all()
    return {"items": [_asset_out(r) for r in rows], "count": len(rows)}


@router.post("/inventory/compatibility")
def compatibility_check(
    body: CompatibilityIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:read", role)
    return evaluate_resource_compatibility(
        db,
        tenant_id=tenant_id,
        asset_id=body.asset_id,
        execution_class=body.execution_class,
        asset_class=body.asset_class,
        lifecycle_states=body.lifecycle_states,
    )


@router.get("/virtual-pools")
def list_virtual_pools(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:read", role)
    from app.models.development import VirtualResourcePoolModel

    rows = (
        db.query(VirtualResourcePoolModel)
        .filter(VirtualResourcePoolModel.tenant_id == tenant_id)
        .order_by(VirtualResourcePoolModel.created_at.desc())
        .limit(100)
        .all()
    )
    return {"items": [pool_to_dict(db, p) for p in rows]}


@router.post("/virtual-pools")
def create_virtual_pool(
    body: PoolIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:import", role)
    try:
        row = create_pool(db, tenant_id=tenant_id, name=body.name, description=body.description)
    except CapacityError as exc:
        _raise(exc)
    return pool_to_dict(db, row)


@router.get("/virtual-pools/{pool_id}")
def get_virtual_pool(
    pool_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:read", role)
    from app.models.development import VirtualResourcePoolModel

    pool = (
        db.query(VirtualResourcePoolModel)
        .filter(VirtualResourcePoolModel.tenant_id == tenant_id, VirtualResourcePoolModel.pool_id == pool_id)
        .first()
    )
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    return pool_to_dict(db, pool)


@router.post("/virtual-pools/{pool_id}/members")
def add_virtual_pool_member(
    pool_id: str,
    body: PoolMemberIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:import", role)
    try:
        add_pool_member(db, tenant_id=tenant_id, pool_id=pool_id, asset_id=body.asset_id)
    except CapacityError as exc:
        _raise(exc)
    from app.models.development import VirtualResourcePoolModel

    pool = (
        db.query(VirtualResourcePoolModel)
        .filter(VirtualResourcePoolModel.tenant_id == tenant_id, VirtualResourcePoolModel.pool_id == pool_id)
        .first()
    )
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    return pool_to_dict(db, pool)


@router.get("/inventory/assets/{asset_id}")
def get_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:read", role)
    row = (
        db.query(InventoryAssetModel)
        .filter(InventoryAssetModel.tenant_id == tenant_id, InventoryAssetModel.asset_id == asset_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _asset_out(row)


@router.post("/inventory/assets/{asset_id}/lifecycle")
def asset_lifecycle(
    asset_id: str,
    body: AssetLifecycleIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:import", role)
    try:
        row = transition_asset_lifecycle(
            db,
            tenant_id=tenant_id,
            asset_id=asset_id,
            lifecycle_state=body.lifecycle_state,
        )
    except CapacityError as exc:
        _raise(exc)
    return _asset_out(row)


@router.post("/inventory/imports")
def import_assets(
    body: ImportIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("inventory:import", role)
    return import_assets_csv(db, tenant_id, body.provider_id, body.csv_text)


@router.get("/providers")
def list_providers(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    _require_any(role, "providers:onboard", "inventory:read", "approvals:read")
    return {"items": provider_catalog_items(db)}


@router.get("/connectors")
def list_connectors(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    _require_any(role, "inventory:read", "platform:read", "approvals:read")
    items = provider_catalog_items(db)
    return {
        "items": items,
        "legend": {
            "I1": "Catalogue registered",
            "I2": "Capability manifest on file",
            "I3": "Observe/collector run recorded",
            "I4": "Submit operation declared (governance handoff path)",
            "I5": "Live dispatch reconciliation (not claimed until connector evidence exists)",
        },
    }


@router.post("/providers/{provider_id}/onboarding")
def onboard(
    provider_id: str,
    body: ManifestIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
):
    _require("providers:onboard", role)
    provider = db.query(ProviderModel).filter(ProviderModel.provider_id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    row = ProviderManifestModel(
        manifest_id=str(uuid.uuid4()),
        provider_id=provider_id,
        operations_json=body.operations,
        execution_classes_json=body.execution_classes,
        created_by=username,
    )
    db.add(row)
    db.commit()
    return {"manifest_id": row.manifest_id, "operations": body.operations}


@router.post("/providers/{provider_id}/transition")
def transition(
    provider_id: str,
    body: ProviderTransitionIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
):
    _require("providers:suspend", role)
    provider = db.query(ProviderModel).filter(ProviderModel.provider_id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    provider.status = body.status
    db.commit()
    return {"provider_id": provider_id, "status": provider.status}


@router.get("/dispatch-icd")
def dispatch_icd_spec(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    """Manual dispatch ICD — live vendor adapter uses same reconcile contract when wired."""
    _require_any(role, "approvals:read", "executions:submit", "dispatch:reconcile", "platform:read")
    return {
        "icd_version": "qre-dispatch-manual-v1",
        "live_connector": False,
        "reconcile_outcomes": ["confirmed", "failed", "unresolved"],
        "required_fields": {
            "confirmed": ["external_job_id"],
            "failed": [],
            "unresolved": [],
        },
        "authorize_dispatch": "POST /workloads/{id}/authorize-dispatch",
        "record_attempt": "POST /workloads/{id}/dispatch-attempts",
        "reconcile": "POST /dispatch-attempts/{id}/reconcile",
        "notes": "Govern records governance state only until provider connector service is deployed.",
    }


@router.get("/dispatch-attempts")
def dispatch_attempts_list(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require_any(role, "approvals:read", "executions:submit", "approvals:decide")
    return {"items": list_dispatch_attempts(db, tenant_id=tenant_id)}


@router.get("/dispatch-attempts/{attempt_id}")
def dispatch_attempt_get(
    attempt_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require_any(role, "approvals:read", "executions:submit", "approvals:decide", "dispatch:reconcile")
    row = get_dispatch_attempt(db, tenant_id=tenant_id, attempt_id=attempt_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dispatch attempt not found")
    return {
        "attempt_id": row.attempt_id,
        "workload_id": row.workload_id,
        "dispatch_state": row.dispatch_state,
        "execution_class": row.execution_class,
        "backend_id": row.backend_id,
        "external_job_id": row.external_job_id,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("/dispatch-attempts/{attempt_id}/reconcile")
def dispatch_attempt_reconcile(
    attempt_id: str,
    body: ReconcileIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    username: str = Depends(get_current_username),
):
    _require_any(role, "dispatch:reconcile", "platform:manage")
    try:
        result = reconcile_dispatch_attempt(
            db,
            tenant_id=tenant_id,
            attempt_id=attempt_id,
            outcome=body.outcome,
            external_job_id=body.external_job_id,
            actor=username,
            reason=body.reason,
        )
        if body.connector_icd_version:
            result = {**result, "connector_icd_version": body.connector_icd_version}
        return result
    except CapacityError as exc:
        _raise(exc)


@router.post("/workloads/{workload_id}/dispatch-attempts")
def dispatch_attempt(
    workload_id: str,
    body: DispatchAttemptIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    username: str = Depends(get_current_username),
):
    _require("executions:submit", role)
    try:
        return create_dispatch_attempt(
            db,
            tenant_id=tenant_id,
            workload_id=workload_id,
            idempotency_key=body.idempotency_key,
            execution_class=body.execution_class,
            backend_id=body.backend_id,
            actor=username,
        )
    except CapacityError as exc:
        _raise(exc)


@router.post("/workloads/{workload_id}/authorize-dispatch")
def authorize(
    workload_id: str,
    body: AuthorizeIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("approvals:decide", role)
    try:
        return authorize_dispatch(
            db,
            tenant_id=tenant_id,
            workload_id=workload_id,
            execution_class=body.execution_class,
            backend_id=body.backend_id,
        )
    except CapacityError as exc:
        _raise(exc)


@router.post("/policies/{policy_id}/dry-run")
def dry_run(
    policy_id: str,
    body: DryRunIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require("policies:read", role)
    policy = load_approval_policy()
    sub = (
        db.query(WorkloadSubmissionModel)
        .filter(WorkloadSubmissionModel.workload_id == body.workload_id, WorkloadSubmissionModel.tenant_id == tenant_id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Workload not found")
    state = sub.governance_state or ""
    reason_codes: List[str] = []
    if state == "approved":
        decision = "ALLOW"
    elif state in ("rejected", "withdrawn"):
        decision = "DENY"
        reason_codes.append("APPROVAL_TERMINAL")
    else:
        decision = "PENDING"
        reason_codes.append("APPROVAL_INCOMPLETE")
    progress = governance_progress(sub)
    return {
        "decision": decision,
        "reason_codes": reason_codes,
        "resource_id": body.workload_id,
        "policy_id": policy.get("policy_id"),
        "requested_policy_id": policy_id,
        "policy_versions": [str(progress.get("policy_version") or policy.get("version") or "unknown")],
        "stages": policy.get("stages"),
        "governance_state": state,
        "progress": progress,
        "would_approve": state == "approved",
        "writes": False,
        "evaluated_at": sub.updated_at.isoformat() if sub.updated_at else None,
    }


@router.post("/meter-samples")
def post_meter_sample(
    body: MeterSampleIn,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require_any(role, "metering:ingest", "platform:manage")
    try:
        return ingest_meter_sample(
            db,
            tenant_id=tenant_id,
            dimension=body.dimension,
            metric=body.metric,
            unit=body.unit,
            value=body.value,
            source_time=body.source_time,
            connector_id=body.connector_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/meter-rollups")
def get_meter_rollups(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    hours: int = Query(24, ge=1, le=720),
    dimension: Optional[str] = Query(None, max_length=256),
):
    _require_any(role, "metering:read", "reports:read", "platform:read")
    return list_meter_rollups(db, tenant_id=tenant_id, hours=hours, dimension=dimension)


@router.get("/meter-rollups/export")
def export_meter_rollups(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    hours: int = Query(24, ge=1, le=720),
):
    _require_any(role, "metering:export", "reports:export", "platform:manage")
    csv_text = export_meter_rollups_csv(db, tenant_id=tenant_id, hours=hours)
    return PlainTextResponse(csv_text, media_type="text/csv")
