import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.evidence.snapshot_builder import (
    build_evidence_payload,
    new_snapshot_id,
    package_evidence_zip,
    write_evidence_archive,
    EVIDENCE_DIR,
)
from app.models.entities import EvidenceSnapshotModel
from app.core.rbac import require_evidence_reader, require_operator

router = APIRouter(prefix="/evidence", tags=["Evidence"])


class EvidenceSnapshotRequest(BaseModel):
    backend_id: Optional[str] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    include_alerts: bool = True
    include_incidents: bool = True
    include_calibration: bool = True
    include_qubit_summary: bool = True
    label: Optional[str] = None
    created_by: Optional[str] = "operator"


class EvidenceSnapshotSummary(BaseModel):
    snapshot_id: str
    label: Optional[str]
    scope_backend_id: Optional[str]
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    manifest_sha256: str
    package_sha256: str
    created_at: datetime
    created_by: Optional[str]


@router.post("/snapshots", response_model=EvidenceSnapshotSummary)
def create_evidence_snapshot(
    body: EvidenceSnapshotRequest,
    db: Session = Depends(get_db),
    _: str = Depends(require_operator),
):
    snapshot_id = new_snapshot_id()
    payload = build_evidence_payload(
        db,
        backend_id=body.backend_id,
        period_start=body.period_start,
        period_end=body.period_end,
        include_alerts=body.include_alerts,
        include_incidents=body.include_incidents,
        include_calibration=body.include_calibration,
        include_qubit_summary=body.include_qubit_summary,
    )
    zip_bytes, manifest = package_evidence_zip(snapshot_id, payload)
    path = write_evidence_archive(snapshot_id, zip_bytes)
    record = EvidenceSnapshotModel(
        snapshot_id=snapshot_id,
        label=body.label or f"Evidence {snapshot_id}",
        scope_backend_id=body.backend_id,
        period_start=body.period_start,
        period_end=body.period_end,
        manifest_sha256=manifest.get("manifest_sha256", ""),
        package_sha256=manifest["package_sha256"],
        storage_path=path,
        provenance_json=payload.get("provenance"),
        created_by=body.created_by,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return EvidenceSnapshotSummary(
        snapshot_id=record.snapshot_id,
        label=record.label,
        scope_backend_id=record.scope_backend_id,
        period_start=record.period_start,
        period_end=record.period_end,
        manifest_sha256=record.manifest_sha256,
        package_sha256=record.package_sha256,
        created_at=record.created_at,
        created_by=record.created_by,
    )


@router.get("/snapshots", response_model=List[EvidenceSnapshotSummary])
def list_evidence_snapshots(db: Session = Depends(get_db), limit: int = 30):
    rows = (
        db.query(EvidenceSnapshotModel)
        .order_by(EvidenceSnapshotModel.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        EvidenceSnapshotSummary(
            snapshot_id=r.snapshot_id,
            label=r.label,
            scope_backend_id=r.scope_backend_id,
            period_start=r.period_start,
            period_end=r.period_end,
            manifest_sha256=r.manifest_sha256,
            package_sha256=r.package_sha256,
            created_at=r.created_at,
            created_by=r.created_by,
        )
        for r in rows
    ]


@router.get("/snapshots/{snapshot_id}/manifest")
def get_snapshot_manifest(snapshot_id: str, db: Session = Depends(get_db)):
    rec = db.query(EvidenceSnapshotModel).filter(EvidenceSnapshotModel.snapshot_id == snapshot_id).first()
    if not rec or not os.path.isfile(rec.storage_path):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    import json
    import zipfile

    with zipfile.ZipFile(rec.storage_path, "r") as zf:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
    return manifest


@router.get("/snapshots/{snapshot_id}/download")
def download_evidence_snapshot(
    snapshot_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_evidence_reader),
):
    rec = db.query(EvidenceSnapshotModel).filter(EvidenceSnapshotModel.snapshot_id == snapshot_id).first()
    if not rec or not os.path.isfile(rec.storage_path):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(
        rec.storage_path,
        media_type="application/zip",
        filename=f"{snapshot_id}.zip",
    )
