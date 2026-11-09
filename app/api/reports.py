from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, load_only
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from app.core.database import get_db
from app.models.entities import BackendModel, AlertModel, CalibrationSnapshotModel, AlertRuleModel
from app.reports.report_generator import ReportGenerator
from app.providers.catalog import CATALOG, stored_configured
from app.facility.env_store import load_rows as load_env_rows
from app.api.environment import import_environment, EnvImport
from app.core.rbac import require_operator

router = APIRouter(prefix="/reports", tags=["Reports"])

EXPORT_ROW_CAP = 5_000
MAX_BUNDLE_BYTES = 2_000_000

_BACKEND_COLS = load_only(
    BackendModel.backend_id,
    BackendModel.backend_name,
    BackendModel.provider_id,
    BackendModel.backend_type,
    BackendModel.qubit_count,
    BackendModel.operational_status,
    BackendModel.quantum_volume,
)

class ReportImportBody(BaseModel):
    """POST /reports/import — environment slice or bundle wrapper."""

    model_config = ConfigDict(extra="ignore")

    kind: str = Field(default="environment", max_length=64)
    records: List[Dict[str, Any]] = Field(default_factory=list, max_length=2_000)
    environment: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=2_000)


_ALERT_COLS = load_only(
    AlertModel.alert_id,
    AlertModel.resource_id,
    AlertModel.alert_type,
    AlertModel.severity,
    AlertModel.status,
    AlertModel.detected_at,
    AlertModel.message,
)

@router.get("/export")
def export_report(
    report_type: str = "backend_monitoring",
    format: str = "csv",
    db: Session = Depends(get_db)
):
    if report_type == "backend_monitoring":
        backends = db.query(BackendModel).options(_BACKEND_COLS).limit(EXPORT_ROW_CAP).all()
        data = [{
            "backend_id": b.backend_id,
            "backend_name": b.backend_name,
            "provider": b.provider_id,
            "type": b.backend_type,
            "qubits": b.qubit_count,
            "status": b.operational_status,
            "quantum_volume": b.quantum_volume
        } for b in backends]
        fieldnames = ["backend_id", "backend_name", "provider", "type", "qubits", "status", "quantum_volume"]
        title = "Quantum Backend Monitoring Report"
        subtitle = "Inventory, Operational Status, and Capabilities"

    elif report_type == "alerts":
        alerts = (
            db.query(AlertModel)
            .options(_ALERT_COLS)
            .order_by(AlertModel.detected_at.desc())
            .limit(EXPORT_ROW_CAP)
            .all()
        )
        data = [{
            "alert_id": a.alert_id,
            "resource": a.resource_id,
            "type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "detected_at": str(a.detected_at)
        } for a in alerts]
        fieldnames = ["alert_id", "resource", "type", "severity", "status", "detected_at"]
        title = "Alert & Incident Report"
        subtitle = "Active, Acknowledged, and Resolved System Alerts"
        
    else: # calibration report
        snaps = (
            db.query(CalibrationSnapshotModel)
            .order_by(CalibrationSnapshotModel.timestamp.desc())
            .limit(EXPORT_ROW_CAP)
            .all()
        )
        data = [{
            "backend_id": s.backend_id,
            "calibration_id": s.calibration_identifier,
            "age_hours": s.calibration_age,
            "freshness": s.freshness_status,
            "timestamp": str(s.timestamp)
        } for s in snaps]
        fieldnames = ["backend_id", "calibration_id", "age_hours", "freshness", "timestamp"]
        title = "Calibration Freshness Report"
        subtitle = "Calibration Timestamps and Freshness Audit"

    if format == "json":
        return {"kind": report_type, "title": title, "records": data}
    if format == "html" or format == "pdf":
        summary = {"total_records": len(data), "export_format": format.upper()}
        html_content = ReportGenerator.generate_html_report(title, subtitle, summary, data)
        return HTMLResponse(content=html_content, status_code=200)
    csv_data = ReportGenerator.generate_csv_report(data, fieldnames)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"}
    )


@router.get("/bundle")
def export_bundle(db: Session = Depends(get_db)):
    backends = db.query(BackendModel).options(_BACKEND_COLS).limit(EXPORT_ROW_CAP).all()
    alerts = (
        db.query(AlertModel)
        .options(_ALERT_COLS)
        .order_by(AlertModel.detected_at.desc())
        .limit(EXPORT_ROW_CAP)
        .all()
    )
    snaps = (
        db.query(CalibrationSnapshotModel)
        .order_by(CalibrationSnapshotModel.timestamp.desc())
        .limit(EXPORT_ROW_CAP)
        .all()
    )
    rules = db.query(AlertRuleModel).limit(EXPORT_ROW_CAP).all()
    creds = [
        {
            "id": p["id"],
            "name": p["name"],
            "adapter": p["adapter"],
            "is_configured": stored_configured(p["id"]),
        }
        for p in CATALOG
    ]
    return {
        "kind": "qtelescope_bundle",
        "backends": [{
            "backend_id": b.backend_id,
            "backend_name": b.backend_name,
            "provider": b.provider_id,
            "type": b.backend_type,
            "qubits": b.qubit_count,
            "status": b.operational_status,
        } for b in backends],
        "alerts": [{
            "alert_id": a.alert_id,
            "resource": a.resource_id,
            "type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "detected_at": str(a.detected_at),
            "message": a.message,
        } for a in alerts],
        "calibrations": [{
            "backend_id": s.backend_id,
            "calibration_id": s.calibration_identifier,
            "age_hours": s.calibration_age,
            "freshness": s.freshness_status,
            "timestamp": str(s.timestamp),
        } for s in snaps],
        "alert_rules": [{
            "rule_id": r.rule_id,
            "metric_name": r.metric_name,
            "operator": r.operator,
            "threshold_value": r.threshold_value,
            "severity": r.severity,
            "enabled": r.enabled,
        } for r in rules],
        "credentials_status": creds,
        "environment": load_env_rows(),
        "export_cap": EXPORT_ROW_CAP,
    }


@router.post("/import")
def import_bundle(body: ReportImportBody, db: Session = Depends(get_db), _: str = Depends(require_operator)):
    import json

    payload = body.model_dump()
    if len(json.dumps(payload, default=str)) > MAX_BUNDLE_BYTES:
        raise HTTPException(status_code=413, detail=f"Import payload exceeds {MAX_BUNDLE_BYTES} bytes")
    kind = (body.kind or "").lower()
    if kind in ("environment", "env"):
        recs = body.records or body.environment or []
        return import_environment(EnvImport(kind="environment", records=recs))
    if kind in ("qtelescope_bundle", "bundle") and body.environment:
        return import_environment(EnvImport(kind="environment", records=body.environment))
    raise HTTPException(
        status_code=400,
        detail="Supported import kinds: environment (records[]), or qtelescope_bundle with environment[].",
    )
