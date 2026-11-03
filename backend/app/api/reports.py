from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.entities import BackendModel, QubitTelemetryModel, AlertModel, CalibrationSnapshotModel
from app.reports.report_generator import ReportGenerator

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

    if format == "html" or format == "pdf":
        summary = {"total_records": len(data), "export_format": format.upper()}
        html_content = ReportGenerator.generate_html_report(title, subtitle, summary, data)
        return HTMLResponse(content=html_content, status_code=200)
    else: # CSV
        csv_data = ReportGenerator.generate_csv_report(data, fieldnames)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"}
        )
