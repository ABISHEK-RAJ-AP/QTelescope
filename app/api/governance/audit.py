"""Governance activity and platform audit read API."""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import role_has_permission
from app.core.rbac import get_current_role, rbac_enforced
from app.core.tenant import get_current_tenant
from app.federated.aggregator import build_national_summary
from app.models.development import ApprovalRecordModel, WorkloadSubmissionModel
from app.models.entities import AuditEventModel
from app.services.governance_audit_export import export_audit_events_csv, export_governance_activity_csv

router = APIRouter(prefix="/governance", tags=["governance"])


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


@router.get("/activity")
def governance_activity(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    project_id: Optional[str] = Query(None, max_length=128),
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    _require("approvals:read", role)
    q = db.query(ApprovalRecordModel, WorkloadSubmissionModel.project_id).filter(
        ApprovalRecordModel.tenant_id == tenant_id,
    )
    q = q.join(
        WorkloadSubmissionModel,
        WorkloadSubmissionModel.submission_id == ApprovalRecordModel.submission_id,
    )
    if project_id:
        q = q.filter(WorkloadSubmissionModel.project_id == project_id)
    rows = q.order_by(ApprovalRecordModel.created_at.desc()).limit(limit).all()
    return {
        "items": [
            {
                "id": r.record_id,
                "kind": "approval_decision",
                "timestamp": r.created_at.isoformat() if r.created_at else None,
                "actor": r.actor_username,
                "action": f"approval.{r.decision}",
                "target_type": "workload",
                "target_id": r.workload_id,
                "detail": {
                    "stage_id": r.stage_id,
                    "policy_id": r.policy_id,
                    "policy_version": r.policy_version,
                    "comment": r.comment,
                    "project_id": proj_id,
                },
            }
            for r, proj_id in rows
        ],
        "source": "approval_records",
        "tenant_id": tenant_id,
        "project_id": project_id,
    }


@router.get("/audit-events")
def governance_audit_events(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    limit: int = Query(50, ge=1, le=200),
    action_prefix: str = Query("", max_length=64),
) -> Dict[str, Any]:
    _require("audit:read", role)
    q = db.query(AuditEventModel).order_by(AuditEventModel.timestamp.desc())
    if action_prefix:
        q = q.filter(AuditEventModel.action.startswith(action_prefix))
    rows = q.limit(limit).all()
    return {
        "items": [
            {
                "id": row.id,
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                "actor": row.actor,
                "role": row.role,
                "action": row.action,
                "target_type": row.resource_type,
                "target_id": row.resource_id,
                "detail": row.detail or {},
            }
            for row in rows
        ],
        "source": "audit_events",
    }


@router.get("/activity/export")
def governance_activity_export(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
    project_id: Optional[str] = Query(None, max_length=128),
    limit: int = Query(500, ge=1, le=2000),
):
    _require("audit:export", role)
    csv_text = export_governance_activity_csv(db, tenant_id=tenant_id, project_id=project_id, limit=limit)
    return PlainTextResponse(csv_text, media_type="text/csv")


@router.get("/audit-events/export")
def governance_audit_events_export(
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    limit: int = Query(500, ge=1, le=2000),
    action_prefix: str = Query("", max_length=64),
):
    _require("audit:export", role)
    csv_text = export_audit_events_csv(db, action_prefix=action_prefix, limit=limit)
    return PlainTextResponse(csv_text, media_type="text/csv")


@router.get("/institution-boundary")
def institution_boundary(
    request: Request,
    db: Session = Depends(get_db),
    role: str = Depends(get_current_role),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    _require_any(role, "approvals:read", "platform:read", "audit:read")
    fed = build_national_summary(db)
    dev_override = bool(not rbac_enforced() and request.headers.get("X-Tenant-Id"))
    peers = fed.get("peer_sites") or []
    peers_ok = sum(1 for p in peers if p.get("sync_status") == "OK")
    return {
        "active_tenant_id": tenant_id,
        "governance_data_scope": "tenant_isolated",
        "cross_tenant_governance_reads": False,
        "dev_tenant_header_override": dev_override,
        "federation": {
            "disclaimer": fed.get("disclaimer"),
            "local_site_id": fed["local_site"].get("site_id"),
            "local_site_name": fed["local_site"].get("site_name"),
            "peer_sites_configured": len(peers),
            "peer_sites_reporting": peers_ok,
            "national_sites_reporting": fed.get("national_totals", {}).get("sites_reporting"),
            "read_only": True,
            "observe_aggregate_only": True,
        },
    }


@router.get("/release-evidence")
def release_evidence(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    """Automated release gate pointers for Govern (S11); pilot P0 still manual in checklist."""
    _require_any(role, "platform:read", "audit:read", "approvals:read")
    return {
        "product": "qrp-govern",
        "schema_version": "1",
        "automated_checks": {
            "pytest_modules": [
                "tests/test_governance_g2.py",
                "tests/test_governance_s9.py",
                "tests/test_governance_s10.py",
                "tests/test_governance_journey.py",
                "tests/test_govern_route_inventory.py",
            ],
            "dev_auth_requires_x_qre_dev_ack": True,
            "tenant_isolation_on_approvals": True,
            "od_qrp_02_operational_quota_dashboard": True,
            "od_qrp_02_reservations_ui": True,
        },
        "environment": {
            "enforce_rbac": os.getenv("ENFORCE_RBAC", "false").lower() in ("1", "true", "yes"),
            "database_url_is_sqlite_default": "sqlite" in os.getenv("DATABASE_URL", "sqlite").lower(),
        },
        "documentation": {
            "pilot_checklist": ".planning/qre-platform/QRE_RELEASE_READINESS_CHECKLIST.md",
            "govern_runbook": ".planning/qre-platform/QRP_GOVERN_RUNBOOK.md",
            "threat_model": ".planning/qre-platform/QRE_THREAT_MODEL.md",
        },
    }
