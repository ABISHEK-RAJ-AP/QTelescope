from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import Any, Dict
from app.core.database import get_db
from app.models.entities import BackendModel, AlertModel, CalibrationSnapshotModel, AlertRuleModel
from app.reports.report_generator import ReportGenerator
from app.providers.catalog import CATALOG, stored_configured
from app.facility.env_store import load_rows as load_env_rows
from app.api.environment import import_environment, EnvImport
from app.core.rbac import require_operator

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/export")
def export_report(
    report_type: str = "backend_monitoring",
    format: str = "csv",
    db: Session = Depends(get_db)
):
    if report_type == "backend_monitoring":
        backends = db.query(BackendModel).all()
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
        alerts = db.query(AlertModel).all()
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
        snaps = db.query(CalibrationSnapshotModel).all()
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
    backends = db.query(BackendModel).all()
    alerts = db.query(AlertModel).all()
    snaps = db.query(CalibrationSnapshotModel).all()
    rules = db.query(AlertRuleModel).all()
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
    }


@router.post("/import")
def import_bundle(payload: Dict[str, Any], db: Session = Depends(get_db), _: str = Depends(require_operator)):
    kind = (payload.get("kind") or "").lower()
    if kind in ("environment", "env"):
        recs = payload.get("records") or payload.get("environment") or []
        return import_environment(EnvImport(kind="environment", records=recs))
    if kind in ("qtelescope_bundle", "bundle") and payload.get("environment"):
        recs = payload.get("environment") or []
        return import_environment(EnvImport(kind="environment", records=recs))
    raise HTTPException(
        status_code=400,
        detail="Supported import kinds: environment (records[]), or qtelescope_bundle with environment[].",
    )
