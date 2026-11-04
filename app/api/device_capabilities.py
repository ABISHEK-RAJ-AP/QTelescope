"""Device capability sheets — normalized fleet device/qubit/gate view."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.integrations.device_capabilities.service import build_device_sheets, coverage_report

router = APIRouter(prefix="/device-capabilities", tags=["Device capabilities"])


@router.get("/coverage")
def get_device_capability_coverage():
    return coverage_report()


@router.get("")
@router.get("/devices")
def list_device_capabilities(
    backend_id: Optional[str] = Query(None),
    include_qubits: bool = Query(True),
    include_gates: bool = Query(True),
    include_jobs: bool = Query(False),
    db: Session = Depends(get_db),
):
    devices = build_device_sheets(
        db,
        backend_id=backend_id,
        include_qubits=include_qubits,
        include_gates=include_gates,
        include_jobs=include_jobs,
    )
    if backend_id and not devices:
        raise HTTPException(status_code=404, detail="Backend not found in fleet")
    return {
        "count": len(devices),
        "devices": devices,
        **coverage_report(),
    }


@router.get("/devices/{backend_id}")
def get_device_capability(
    backend_id: str,
    include_jobs: bool = Query(True),
    db: Session = Depends(get_db),
):
    devices = build_device_sheets(
        db,
        backend_id=backend_id,
        include_qubits=True,
        include_gates=True,
        include_jobs=include_jobs,
    )
    if not devices:
        raise HTTPException(status_code=404, detail="Backend not found in fleet")
    return devices[0]
