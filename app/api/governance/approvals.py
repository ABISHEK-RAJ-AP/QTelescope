"""Governance approvals — policy-driven multi-stage FSM."""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, get_current_username, rbac_enforced
from app.core.tenant import get_current_tenant
from app.models.development import ApprovalRecordModel, InventoryAssetModel, WorkloadSubmissionModel
from app.discovery.hardware_discovery import ensure_discovered
from app.models.entities import ProviderModel
from app.services.approval_fsm import (
    GovernanceError,
    REVIEW_STATES,
    apply_decision,
    governance_progress,
    load_approval_policy,
    withdraw_submission,
)
from app.services.tenant_quota import tenant_sim_shot_quota

router = APIRouter(prefix="/approvals", tags=["governance"])


class ApprovalDecide(BaseModel):
    decision: Literal["approve", "reject", "changes_requested"]
    comment: Optional[str] = None
    expected_stage_id: Optional[str] = None


class WithdrawBody(BaseModel):
    comment: Optional[str] = None


def _item(s: WorkloadSubmissionModel) -> Dict[str, Any]:
    return {
        "workload_id": s.workload_id,
        "submission_id": s.submission_id,
        "project_id": s.project_id,
        "package_sha256": s.package_sha256,
        "governance_state": s.governance_state,
        "governance_progress": governance_progress(s),
        "created_by": s.created_by,
        "created_at": s.created_at,
    }


def _in_my_work(item: Dict[str, Any], username: str, role: str) -> bool:
    state = item.get("governance_state")
    if item.get("created_by") == username and state not in ("approved", "withdrawn", "rejected"):
        return True
    if state not in REVIEW_STATES:
        return False
    stage = (item.get("governance_progress") or {}).get("current_stage") or {}
    perm = stage.get("required_permission") or "approvals:decide"
    return role_has_permission(role, perm)


def _raise_gov(exc: GovernanceError) -> None:
    raise HTTPException(status_code=exc.status, detail=exc.detail) from exc


def _require(perm: str, role: str) -> None:
    if not rbac_enforced():
        return
    if not role_has_permission(role, perm):
        raise HTTPException(status_code=403, detail=f"Permission denied: {perm}")


@router.get("/policy")
def get_approval_policy(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    _require("approvals:read", role)
    return load_approval_policy()


@router.get("")
def list_pending_approvals(
    state: Optional[str] = Query(None),
    scope: Optional[Literal["mine"]] = Query(None),
    project_id: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require("approvals:read", role)
    allowed = REVIEW_STATES | {"changes_requested", "rejected", "approved", "withdrawn", "draft"}
    if state and state not in allowed:
        raise HTTPException(status_code=422, detail="Unknown governance state")
    wanted = (state,) if state else tuple(REVIEW_STATES)
    if scope == "mine" and not state:
        wanted = tuple(REVIEW_STATES | {"changes_requested", "draft"})
    q = db.query(WorkloadSubmissionModel).filter(
        WorkloadSubmissionModel.tenant_id == tenant_id,
        WorkloadSubmissionModel.governance_state.in_(wanted),
    )
    if project_id:
        q = q.filter(WorkloadSubmissionModel.project_id == project_id)
    rows = q.order_by(WorkloadSubmissionModel.created_at.desc()).limit(100).all()
    items = [_item(s) for s in rows]
    if scope == "mine":
        items = [i for i in items if _in_my_work(i, username, role)]
    return {
        "items": items,
        "count": len(items),
        "scope": scope,
        "project_id": project_id,
        "policy": load_approval_policy(),
    }


@router.get("/{workload_id}/history")
def approval_history(
    workload_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("approvals:read", role)
    rows = (
        db.query(ApprovalRecordModel)
        .filter(ApprovalRecordModel.workload_id == workload_id, ApprovalRecordModel.tenant_id == tenant_id)
        .order_by(ApprovalRecordModel.created_at.asc())
        .all()
    )
    return {
        "workload_id": workload_id,
        "records": [
            {
                "record_id": r.record_id,
                "stage_id": r.stage_id,
                "decision": r.decision,
                "actor_username": r.actor_username,
                "comment": r.comment,
                "policy_id": r.policy_id,
                "policy_version": r.policy_version,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


@router.post("/{workload_id}/decide")
def decide_approval(
    workload_id: str,
    body: ApprovalDecide,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("approvals:decide", role)
    sub = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.workload_id == workload_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    policy = load_approval_policy()
    allow_override = bool(policy.get("override_enabled")) and role_has_permission(role, "approvals:override")
    try:
        updated, outcome = apply_decision(
            db,
            sub,
            decision=body.decision,
            actor=username,
            comment=body.comment,
            expected_stage_id=body.expected_stage_id,
            allow_override=allow_override,
        )
    except GovernanceError as e:
        _raise_gov(e)
    return {
        "workload_id": workload_id,
        "governance_state": updated.governance_state,
        "outcome": outcome,
    }


def _load_sub(db: Session, workload_id: str, tenant_id: str) -> WorkloadSubmissionModel:
    sub = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.workload_id == workload_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
        )
        .order_by(WorkloadSubmissionModel.created_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


@router.get("/{workload_id}")
def get_approval(
    workload_id: str,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
):
    _require("approvals:read", role)
    sub = _load_sub(db, workload_id, tenant_id)
    hist = approval_history(workload_id, db=db, role=role, tenant_id=tenant_id)
    return {**_item(sub), "history": hist["records"]}


@router.post("/{workload_id}/withdraw")
def withdraw_approval(
    workload_id: str,
    body: WithdrawBody,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    username: str = Depends(get_current_username),
    tenant_id: str = Depends(get_current_tenant),
):
    sub = _load_sub(db, workload_id, tenant_id)
    try:
        updated = withdraw_submission(
            db,
            sub,
            actor=username,
            comment=body.comment,
            actor_may_withdraw_others=role_has_permission(role, "approvals:withdraw"),
        )
    except GovernanceError as e:
        _raise_gov(e)
    return _item(updated)


summary_router = APIRouter(prefix="/governance", tags=["governance"])


def _submissions_for_tenant(db: Session, tenant_id: str, project_id: Optional[str] = None):
    q = db.query(WorkloadSubmissionModel).filter(WorkloadSubmissionModel.tenant_id == tenant_id)
    if project_id:
        q = q.filter(WorkloadSubmissionModel.project_id == project_id)
    return q


@summary_router.get("/summary")
def governance_summary(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    project_id: Optional[str] = Query(None, max_length=128),
) -> Dict[str, Any]:
    _require("approvals:read", role)
    ensure_discovered(db)
    states = ("submitted_for_review", "in_review", "changes_requested", "rejected", "approved", "withdrawn")
    counts = {}
    for state in states:
        counts[state] = _submissions_for_tenant(db, tenant_id, project_id).filter(
            WorkloadSubmissionModel.governance_state == state,
        ).count()
    policy = load_approval_policy()
    pending_review = _submissions_for_tenant(db, tenant_id, project_id).filter(
        WorkloadSubmissionModel.governance_state == "pending_review",
    ).count()
    if pending_review:
        counts["pending_review"] = pending_review
    providers = db.query(ProviderModel).all()
    active_providers = sum(1 for p in providers if (p.status or "active") != "suspended")
    from app.services.metering import count_recent_samples

    meter_samples_24h = count_recent_samples(db, tenant_id=tenant_id, hours=24)
    return {
        "counts": counts,
        "queue": counts["submitted_for_review"] + counts["in_review"] + pending_review,
        "policy_id": policy.get("policy_id"),
        "policy_version": policy.get("schema_version"),
        "stage_count": len(policy.get("stages") or []),
        "providers_active": active_providers,
        "providers_total": len(providers),
        "inventory_assets": db.query(InventoryAssetModel).filter(InventoryAssetModel.tenant_id == tenant_id).count(),
        "meter_samples_24h": meter_samples_24h,
        "quota": tenant_sim_shot_quota(db, tenant_id),
        "source": "workload_submissions",
        "project_id": project_id,
    }


@summary_router.get("/notifications/config")
def governance_notifications_config(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    _require("approvals:read", role)
    from app.services.governance_notify import load_notifications_config

    return load_notifications_config()
