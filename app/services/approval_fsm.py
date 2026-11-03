from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.development import ApprovalRecordModel, WorkloadModel, WorkloadSubmissionModel
from app.services import development_service as dev_svc

_POLICY_CACHE: Optional[Dict[str, Any]] = None
REVIEW_STATES = frozenset({"submitted_for_review", "in_review"})


class GovernanceError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def load_approval_policy() -> Dict[str, Any]:
    global _POLICY_CACHE
    if _POLICY_CACHE is not None:
        return _POLICY_CACHE
    root = Path(__file__).resolve().parents[2]
    path = root / "config" / "approval_policy.json"
    if not path.is_file():
        _POLICY_CACHE = {"schema_version": 1, "stages": [{"id": "default", "label": "Review"}]}
        return _POLICY_CACHE
    _POLICY_CACHE = json.loads(path.read_text(encoding="utf-8"))
    return _POLICY_CACHE


def _approval_meta(sub: WorkloadSubmissionModel) -> Dict[str, Any]:
    manifest = dict(sub.manifest_json or {})
    approval = dict(manifest.get("approval") or {})
    return approval


def _set_approval_meta(sub: WorkloadSubmissionModel, approval: Dict[str, Any]) -> None:
    manifest = dict(sub.manifest_json or {})
    manifest["approval"] = approval
    sub.manifest_json = manifest


def governance_progress(sub: WorkloadSubmissionModel) -> Dict[str, Any]:
    policy = load_approval_policy()
    stages: List[Dict[str, Any]] = policy.get("stages") or []
    approval = _approval_meta(sub)
    idx = int(approval.get("stage_index", 0))
    current = stages[idx] if idx < len(stages) else None
    return {
        "governance_state": sub.governance_state,
        "policy_id": approval.get("policy_id") or policy.get("policy_id"),
        "policy_version": approval.get("policy_version") if approval.get("policy_version") is not None else policy.get("schema_version"),
        "stage_index": idx,
        "stage_total": len(stages),
        "current_stage": current,
        "stages": stages,
    }


def _sync_workload(db: Session, sub: WorkloadSubmissionModel) -> None:
    wl = db.query(WorkloadModel).filter(WorkloadModel.workload_id == sub.workload_id).first()
    if wl:
        wl.state = sub.governance_state


def enter_review(db: Session, sub: WorkloadSubmissionModel) -> WorkloadSubmissionModel:
    if sub.governance_state not in ("draft", "changes_requested"):
        raise ValueError(f"Cannot submit from state {sub.governance_state}")
    policy = load_approval_policy()
    stages = policy.get("stages") or [{"id": "default", "label": "Review"}]
    _set_approval_meta(
        sub,
        {
            "stage_index": 0,
            "stage_id": stages[0]["id"],
            "policy_id": policy.get("policy_id"),
            "policy_version": policy.get("schema_version"),
        },
    )
    sub.governance_state = "submitted_for_review"
    _sync_workload(db, sub)
    dev_svc.append_timeline(
        db,
        sub.workload_id,
        "governance",
        "approval.entered",
        {"submission_id": sub.submission_id, "stage_id": stages[0]["id"]},
    )
    from app.services.governance_notify import emit_governance_notify

    emit_governance_notify(
        "submission.entered_review",
        {"workload_id": sub.workload_id, "submission_id": sub.submission_id, "stage_id": stages[0]["id"]},
        db=db,
        workload_id=sub.workload_id,
    )
    db.commit()
    db.refresh(sub)
    return sub


def _frozen_policy(sub: WorkloadSubmissionModel) -> Tuple[str, str]:
    approval = _approval_meta(sub)
    policy = load_approval_policy()
    policy_id = str(approval.get("policy_id") or policy.get("policy_id") or "default")
    version = approval.get("policy_version")
    if version is None:
        version = policy.get("schema_version", 1)
    return policy_id, str(version)


def apply_decision(
    db: Session,
    sub: WorkloadSubmissionModel,
    *,
    decision: str,
    actor: str,
    comment: Optional[str],
    expected_stage_id: Optional[str] = None,
    allow_override: bool = False,
) -> Tuple[WorkloadSubmissionModel, Dict[str, Any]]:
    if sub.governance_state not in REVIEW_STATES:
        raise GovernanceError(409, f"Not in review: {sub.governance_state}")
    if decision == "changes_requested" and not (comment or "").strip():
        raise GovernanceError(422, "Comment required when requesting changes")
    if actor == sub.created_by and not allow_override:
        raise GovernanceError(403, "Requester cannot decide their own submission")

    policy = load_approval_policy()
    stages: List[Dict[str, Any]] = policy.get("stages") or [{"id": "default"}]
    approval = _approval_meta(sub)
    idx = int(approval.get("stage_index", 0))
    stage_id = stages[idx]["id"] if idx < len(stages) else "default"
    if expected_stage_id and expected_stage_id != stage_id:
        raise GovernanceError(409, f"Stage conflict: current is {stage_id}")

    policy_id, policy_version = _frozen_policy(sub)
    db.add(
        ApprovalRecordModel(
            record_id=str(uuid.uuid4()),
            tenant_id=sub.tenant_id,
            workload_id=sub.workload_id,
            submission_id=sub.submission_id,
            stage_id=stage_id,
            decision=decision,
            actor_username=actor,
            comment=comment,
            policy_id=policy_id,
            policy_version=policy_version,
        )
    )

    outcome: Dict[str, Any] = {
        "decision": decision,
        "stage_id": stage_id,
        "policy_id": policy_id,
        "policy_version": policy_version,
        "final": False,
    }

    if decision in ("reject", "changes_requested"):
        sub.governance_state = "rejected" if decision == "reject" else "changes_requested"
        _sync_workload(db, sub)
        outcome["final"] = True
    elif decision == "approve":
        if idx + 1 < len(stages):
            approval["stage_index"] = idx + 1
            approval["stage_id"] = stages[idx + 1]["id"]
            _set_approval_meta(sub, approval)
            sub.governance_state = "in_review"
            _sync_workload(db, sub)
            outcome["advanced_to_stage"] = stages[idx + 1]["id"]
        else:
            sub.governance_state = "approved"
            _sync_workload(db, sub)
            outcome["final"] = True
    else:
        raise GovernanceError(422, f"Unknown decision: {decision}")

    dev_svc.append_timeline(
        db,
        sub.workload_id,
        "governance",
        f"approval.{decision}",
        {"by": actor, "comment": comment, "stage_id": stage_id, **outcome},
    )
    from app.services.governance_notify import emit_governance_notify

    notify_event = "approval.changes_requested" if decision == "changes_requested" else "approval.decided"
    emit_governance_notify(
        notify_event,
        {
            "workload_id": sub.workload_id,
            "submission_id": sub.submission_id,
            "decision": decision,
            "stage_id": stage_id,
            "final": outcome.get("final"),
        },
        db=db,
        workload_id=sub.workload_id,
    )
    from app.core.audit_log import record_audit

    record_audit(
        f"governance.approval.{decision}",
        actor=actor,
        resource_type="workload",
        resource_id=sub.workload_id,
        detail={"submission_id": sub.submission_id, "stage_id": stage_id, "final": outcome.get("final")},
    )
    db.commit()
    db.refresh(sub)
    outcome["governance_progress"] = governance_progress(sub)
    return sub, outcome


def withdraw_submission(
    db: Session,
    sub: WorkloadSubmissionModel,
    *,
    actor: str,
    comment: Optional[str],
    actor_may_withdraw_others: bool,
) -> WorkloadSubmissionModel:
    if sub.governance_state not in REVIEW_STATES:
        raise GovernanceError(409, f"Cannot withdraw from {sub.governance_state}")
    if actor != sub.created_by and not actor_may_withdraw_others:
        raise GovernanceError(403, "Only the requester or a withdraw role can withdraw")
    policy_id, policy_version = _frozen_policy(sub)
    approval = _approval_meta(sub)
    stage_id = approval.get("stage_id")
    db.add(
        ApprovalRecordModel(
            record_id=str(uuid.uuid4()),
            tenant_id=sub.tenant_id,
            workload_id=sub.workload_id,
            submission_id=sub.submission_id,
            stage_id=stage_id,
            decision="withdraw",
            actor_username=actor,
            comment=comment,
            policy_id=policy_id,
            policy_version=policy_version,
        )
    )
    sub.governance_state = "withdrawn"
    _sync_workload(db, sub)
    dev_svc.append_timeline(
        db,
        sub.workload_id,
        "governance",
        "approval.withdraw",
        {"by": actor, "comment": comment, "stage_id": stage_id, "policy_id": policy_id, "policy_version": policy_version},
    )
    from app.core.audit_log import record_audit

    record_audit(
        "governance.approval.withdraw",
        actor=actor,
        resource_type="workload",
        resource_id=sub.workload_id,
        detail={"submission_id": sub.submission_id},
    )
    db.commit()
    db.refresh(sub)
    return sub
