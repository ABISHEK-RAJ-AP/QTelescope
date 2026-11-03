from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.development import (
    CircuitVersionModel,
    DevProjectModel,
    RegistryTimelineEventModel,
    WorkloadModel,
    WorkloadSubmissionModel,
)
from app.services import development_service as dev_svc


def _hash_package(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def create_submission(
    db: Session,
    *,
    tenant_id: str,
    project: DevProjectModel,
    circuit: Optional[CircuitVersionModel],
    compilation_run_id: Optional[str],
    preflight_report_id: Optional[str],
    created_by: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> WorkloadSubmissionModel:
    workload_id = str(uuid.uuid4())
    db.add(
        WorkloadModel(
            workload_id=workload_id,
            tenant_id=tenant_id,
            project_id=project.project_id,
            state="draft",
            title=f"Submission: {project.name}",
            metadata_json=metadata or {},
            created_by=created_by,
        )
    )
    # Timeline FK requires the workload row to exist before the event insert.
    db.flush()
    manifest = {
        "schema_version": 1,
        "project_id": project.project_id,
        "circuit_id": circuit.circuit_id if circuit else None,
        "compilation_run_id": compilation_run_id,
        "preflight_report_id": preflight_report_id,
        "execution_class": "governed",
        "auto_dispatch": False,
        "metadata": metadata or {},
    }
    package_sha = _hash_package(manifest)
    sid = str(uuid.uuid4())
    sub = WorkloadSubmissionModel(
        submission_id=sid,
        workload_id=workload_id,
        tenant_id=tenant_id,
        project_id=project.project_id,
        circuit_id=circuit.circuit_id if circuit else None,
        compilation_run_id=compilation_run_id,
        preflight_report_id=preflight_report_id,
        package_sha256=package_sha,
        manifest_json=manifest,
        governance_state="draft",
        created_by=created_by,
    )
    db.add(sub)
    dev_svc.append_timeline(
        db,
        workload_id,
        "development",
        "submission.created",
        {"submission_id": sid, "package_sha256": package_sha},
    )
    db.commit()
    db.refresh(sub)
    return sub


def submit_for_review(db: Session, submission: WorkloadSubmissionModel) -> WorkloadSubmissionModel:
    from app.services.approval_fsm import enter_review

    return enter_review(db, submission)
