"""Dispatch attempt row (domain B) — persisted before connector I/O."""
from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.development import DispatchAttemptModel
from app.services.governance_capacity import CapacityError, authorize_dispatch


def create_dispatch_attempt(
    db: Session,
    *,
    tenant_id: str,
    workload_id: str,
    idempotency_key: str,
    execution_class: str,
    backend_id: Optional[str],
    actor: str,
) -> Dict[str, Any]:
    if not idempotency_key.strip():
        raise CapacityError(422, "idempotency_key is required")

    existing = (
        db.query(DispatchAttemptModel)
        .filter(
            DispatchAttemptModel.tenant_id == tenant_id,
            DispatchAttemptModel.idempotency_key == idempotency_key,
        )
        .first()
    )
    if existing:
        return _payload(existing, replay=True)

    auth = authorize_dispatch(
        db,
        tenant_id=tenant_id,
        workload_id=workload_id,
        execution_class=execution_class,
        backend_id=backend_id,
    )
    if not auth["eligible"]:
        raise CapacityError(409, f"Dispatch not authorized: {', '.join(auth['reasons'])}")

    row = DispatchAttemptModel(
        attempt_id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        workload_id=workload_id,
        idempotency_key=idempotency_key,
        execution_class=execution_class,
        backend_id=backend_id,
        dispatch_state="dispatch_attempted",
        external_job_id=None,
        created_by=actor,
    )
    db.add(row)
    db.flush()

    # ponytail: no connector yet — mark authorized after row exists (upgrade path: connector between flush and state)
    row.dispatch_state = "dispatch_authorized"
    db.commit()
    db.refresh(row)
    return _payload(row, replay=False)


_RECONCILE_FROM = frozenset({"dispatch_authorized", "dispatch_unresolved"})


def get_dispatch_attempt(db: Session, *, tenant_id: str, attempt_id: str) -> Optional[DispatchAttemptModel]:
    return (
        db.query(DispatchAttemptModel)
        .filter(DispatchAttemptModel.tenant_id == tenant_id, DispatchAttemptModel.attempt_id == attempt_id)
        .first()
    )


def reconcile_dispatch_attempt(
    db: Session,
    *,
    tenant_id: str,
    attempt_id: str,
    outcome: str,
    external_job_id: Optional[str],
    actor: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    row = get_dispatch_attempt(db, tenant_id=tenant_id, attempt_id=attempt_id)
    if not row:
        raise CapacityError(404, "Dispatch attempt not found")
    if row.dispatch_state not in _RECONCILE_FROM:
        raise CapacityError(409, f"Cannot reconcile from state {row.dispatch_state}")

    outcome = (outcome or "").strip().lower()
    if outcome == "confirmed":
        job = (external_job_id or "").strip()
        if not job:
            raise CapacityError(422, "external_job_id is required when outcome is confirmed")
        row.external_job_id = job
        row.dispatch_state = "dispatch_confirmed"
    elif outcome == "failed":
        row.dispatch_state = "dispatch_failed"
        row.external_job_id = None
    elif outcome == "unresolved":
        row.dispatch_state = "dispatch_unresolved"
    else:
        raise CapacityError(422, "outcome must be confirmed, failed, or unresolved")

    db.commit()
    db.refresh(row)

    from app.core.audit_log import record_audit

    record_audit(
        "dispatch.reconcile",
        actor=actor,
        resource_type="dispatch_attempt",
        resource_id=row.attempt_id,
        detail={
            "outcome": outcome,
            "dispatch_state": row.dispatch_state,
            "external_job_id": row.external_job_id,
            "workload_id": row.workload_id,
            "reason": reason,
        },
    )
    return _payload(row, replay=False)


def list_dispatch_attempts(db: Session, *, tenant_id: str, limit: int = 100) -> list[Dict[str, Any]]:
    rows = (
        db.query(DispatchAttemptModel)
        .filter(DispatchAttemptModel.tenant_id == tenant_id)
        .order_by(DispatchAttemptModel.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "attempt_id": r.attempt_id,
            "workload_id": r.workload_id,
            "dispatch_state": r.dispatch_state,
            "execution_class": r.execution_class,
            "backend_id": r.backend_id,
            "external_job_id": r.external_job_id,
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def _payload(row: DispatchAttemptModel, *, replay: bool) -> Dict[str, Any]:
    return {
        "attempt_id": row.attempt_id,
        "workload_id": row.workload_id,
        "dispatch_state": row.dispatch_state,
        "execution_class": row.execution_class,
        "backend_id": row.backend_id,
        "external_job_id": row.external_job_id,
        "idempotency_key": row.idempotency_key,
        "replay": replay,
    }
