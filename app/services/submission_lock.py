from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.development import WorkloadSubmissionModel

_LOCK_STATES = frozenset({
    "pending_review",
    "submitted_for_review",
    "in_review",
    "approved",
})


def active_submission_lock(db: Session, project_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    row = (
        db.query(WorkloadSubmissionModel)
        .filter(
            WorkloadSubmissionModel.project_id == project_id,
            WorkloadSubmissionModel.tenant_id == tenant_id,
            WorkloadSubmissionModel.governance_state.in_(tuple(_LOCK_STATES)),
        )
        .order_by(WorkloadSubmissionModel.created_at.desc())
        .first()
    )
    if not row:
        return None
    return {
        "locked": True,
        "submission_id": row.submission_id,
        "workload_id": row.workload_id,
        "governance_state": row.governance_state,
        "reason": "Governed submission in review or approved — edit locked until changes requested.",
    }
