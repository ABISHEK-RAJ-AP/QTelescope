"""CSV export for governance activity and platform audit events."""
from __future__ import annotations

import csv
import io
from typing import Optional

from sqlalchemy.orm import Session

from app.models.development import ApprovalRecordModel, WorkloadSubmissionModel
from app.models.entities import AuditEventModel


def export_governance_activity_csv(
    db: Session,
    *,
    tenant_id: str,
    project_id: Optional[str] = None,
    limit: int = 500,
) -> str:
    limit = max(1, min(limit, 2000))
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

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "tenant_id", "actor", "action", "target_type", "target_id", "project_id", "stage_id", "comment"])
    for r, proj_id in rows:
        writer.writerow(
            [
                r.created_at.isoformat() if r.created_at else "",
                tenant_id,
                r.actor_username,
                f"approval.{r.decision}",
                "workload",
                r.workload_id,
                proj_id or "",
                r.stage_id or "",
                (r.comment or "").replace("\n", " "),
            ],
        )
    return buf.getvalue()


def export_audit_events_csv(
    db: Session,
    *,
    action_prefix: str = "",
    limit: int = 500,
) -> str:
    limit = max(1, min(limit, 2000))
    q = db.query(AuditEventModel).order_by(AuditEventModel.timestamp.desc())
    if action_prefix:
        q = q.filter(AuditEventModel.action.startswith(action_prefix))
    rows = q.limit(limit).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "actor", "role", "action", "resource_type", "resource_id", "detail_json"])
    for row in rows:
        writer.writerow(
            [
                row.timestamp.isoformat() if row.timestamp else "",
                row.actor or "",
                row.role or "",
                row.action or "",
                row.resource_type or "",
                row.resource_id or "",
                str(row.detail or {}),
            ],
        )
    return buf.getvalue()
