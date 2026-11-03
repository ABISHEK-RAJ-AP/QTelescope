"""Facility / cryo / RF environment slot. Import JSON; no fake sensors."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.facility.env_store import CHANNELS, load_rows
from app.facility.cryo_rf_adapter import adapter_status, derive_calibration_samples
from app.facility.ingest import append_records, ingest_status, scan_inbox
from app.core.rbac import require_operator

router = APIRouter(prefix="/environment", tags=["Environment"])


class EnvRecord(BaseModel):
    timestamp: Optional[str] = None
    backend_id: str
    channel: str
    value: float
    unit: str = ""
    severity: Optional[str] = None


class EnvImport(BaseModel):
    kind: str = "environment"
    records: List[EnvRecord]


def env_severity_for(backend_id: str) -> Optional[str]:
    rows = [r for r in load_rows() if r.get("backend_id") == backend_id]
    if not rows:
        return None
    if any(str(r.get("severity", "")).upper() == "CRITICAL" for r in rows):
        return "CRITICAL"
    if any(str(r.get("severity", "")).upper() == "WARNING" for r in rows):
        return "WARNING"
    return "OK"


@router.get("/ingest/status")
def environment_ingest_status():
    return ingest_status()


@router.get("/adapter/status")
def environment_adapter_status(db: Session = Depends(get_db)):
    st = adapter_status(db)
    st["vendor_cryo_rf_adapter"] = st.pop("status")
    return st


@router.post("/ingest")
def environment_rest_ingest(payload: EnvImport, _: str = Depends(require_operator)):
    if payload.kind not in ("environment", "env"):
        raise HTTPException(status_code=400, detail="kind must be 'environment'")
    records = [r.model_dump() for r in payload.records]
    added, errors = append_records(records, source="rest")
    return {"status": "SUCCESS", "imported": added, "errors": errors, "total": len(load_rows())}


@router.post("/inbox/scan")
def environment_inbox_scan(_: str = Depends(require_operator)):
    return scan_inbox()


@router.get("")
def list_environment(db: Session = Depends(get_db)):
    imported = load_rows()
    derived = derive_calibration_samples(db)
    for row in imported:
        row = dict(row)
        row.setdefault("source", "import")
        derived.append(row)
    derived.sort(key=lambda r: r.get("timestamp") or "", reverse=True)
    return {"channels": list(CHANNELS), "samples": derived, "imported_count": len(imported)}


@router.get("/template")
def environment_template():
    return {
        "kind": "environment",
        "records": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "backend_id": "ibm_brisbane",
                "channel": "cryo_temp_mK",
                "value": 15.2,
                "unit": "mK",
                "severity": "OK",
            },
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "backend_id": "ibm_brisbane",
                "channel": "vacuum_mbar",
                "value": 1.2e-10,
                "unit": "mbar",
                "severity": "OK",
            },
        ],
    }


@router.post("/import")
def import_environment(payload: EnvImport, _: str = Depends(require_operator)):
    if payload.kind not in ("environment", "env"):
        raise HTTPException(status_code=400, detail="kind must be 'environment'")
    now = datetime.now(timezone.utc).isoformat()
    records = [r.model_dump() for r in payload.records]
    for rec in records:
        rec.setdefault("timestamp", now)
        rec["source"] = "import"
    added, errors = append_records(records, source="import")
    return {"status": "SUCCESS", "imported": added, "errors": errors, "total": len(load_rows())}


@router.get("/export")
def export_environment():
    return {"kind": "environment", "records": load_rows()}
