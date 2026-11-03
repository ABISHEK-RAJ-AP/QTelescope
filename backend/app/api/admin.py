import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import (
    ProviderModel, CollectionScheduleModel, AlertRuleModel, BackendModel,
    QubitModel, ConnectivityEdgeModel, BackendTelemetryModel, QubitTelemetryModel,
    GateTelemetryModel, CalibrationSnapshotModel, JobRecordModel, AlertModel
)
from app.schemas.schemas import (
    ProviderResponse, ScheduleUpdateSchema, AlertRuleSchema,
    AlertRuleCreateSchema, AlertRuleUpdateSchema, DashboardSummaryResponse
)
from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.onprem_adapter import OnPremiseProviderAdapter
from app.collectors.telemetry_collector import TelemetryCollector
from app.discovery.hardware_discovery import ensure_discovered

router = APIRouter(prefix="/admin", tags=["Administration"])

class IbmTokenSchema(BaseModel):
    token: str

class GenericCredentialSchema(BaseModel):
    provider_id: str
    token: Optional[str] = None
    endpoint_url: Optional[str] = None

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    ensure_discovered(db)
    total_b = db.query(BackendModel).count()
    op_b = db.query(BackendModel).filter(BackendModel.operational_status == "ONLINE").count()
    un_b = total_b - op_b
    
    total_q = sum(b.qubit_count for b in db.query(BackendModel).all())
    
    stale_calib = db.query(CalibrationSnapshotModel).filter(CalibrationSnapshotModel.freshness_status.in_(["Stale", "Unknown"])).count()
    active_alerts = db.query(AlertModel).filter(AlertModel.status == "ACTIVE").count()
    
    queued_jobs = db.query(JobRecordModel).filter(JobRecordModel.status == "QUEUED").count()

    return DashboardSummaryResponse(
        total_backends=total_b,
        operational_backends=op_b,
        unavailable_backends=un_b,
        total_qubits=total_q,
        stale_calibration_count=stale_calib,
        active_alerts_count=active_alerts,
        total_pending_jobs=queued_jobs,
        recent_collection_status="ONLINE"
    )

@router.get("/credentials")
def get_configured_credentials():
    """Returns credential status for all supported hardware platforms."""
    return {
        "ibm_quantum": {
            "name": "IBM Quantum Platform",
            "is_configured": bool(settings.IBM_QUANTUM_TOKEN or os.getenv("IBM_QUANTUM_TOKEN", "") or os.path.exists(os.path.expanduser("~/.qiskit/qiskit-ibm.json"))),
            "credential_type": "API Token (Qiskit Runtime / REST)"
        },
        "rigetti_quantum": {
            "name": "Rigetti Computing (QCS / Forest)",
            "is_configured": bool(settings.RIGETTI_API_KEY or os.getenv("RIGETTI_API_KEY", "") or os.getenv("QCS_API_KEY", "") or os.path.exists(os.path.expanduser("~/.qcs/config.toml"))),
            "credential_type": "QCS API Key"
        },
        "ionq_quantum": {
            "name": "IonQ Trapped-Ion Cloud",
            "is_configured": bool(settings.IONQ_API_KEY or os.getenv("IONQ_API_KEY", "")),
            "credential_type": "IonQ Cloud API Key"
        },
        "cdac_quantum": {
            "name": "C-DAC Platform & Local Lab FPGA",
            "is_configured": bool(settings.ONPREM_QPU_URL or os.getenv("ONPREM_QPU_URL", "")),
            "endpoint_url": settings.ONPREM_QPU_URL,
            "credential_type": "REST Endpoint / Socket"
        }
    }

def _update_env_file(key: str, value: str):
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    if not os.path.exists(env_path):
        env_path = ".env"
    try:
        lines = []
        found = False
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith(f"{key}="):
                        lines.append(f"{key}={value}\n")
                        found = True
                    else:
                        lines.append(line)
        if not found:
            lines.append(f"{key}={value}\n")
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
    except Exception as e:
        print(f"Failed to update .env: {e}")

@router.post("/ibm-token")
def save_ibm_token(data: IbmTokenSchema, db: Session = Depends(get_db)):
    token = data.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="IBM Quantum API Token cannot be empty.")

    adapter = IBMProviderAdapter(api_token=token)
    if not adapter.is_authenticated:
        raise HTTPException(status_code=400, detail="Invalid IBM Quantum API Token or authentication failed.")

    os.environ["IBM_QUANTUM_TOKEN"] = token
    _update_env_file("IBM_QUANTUM_TOKEN", token)

    # Synchronize live telemetry
    collector = TelemetryCollector(db, provider_adapter=adapter)
    collector.run_full_collection_cycle()

    backends = adapter.discover_backends()
    b_names = ", ".join([b["backend_name"] for b in backends])
    return {
        "status": "SUCCESS",
        "message": f"IBM Quantum authenticated! Discovered {len(backends)} live QPUs ({b_names}). Telemetry synchronized."
    }

@router.post("/credentials")
def save_provider_credentials(data: GenericCredentialSchema, db: Session = Depends(get_db)):
    """Saves API tokens or endpoints for any quantum hardware provider and synchronizes telemetry."""
    prov = data.provider_id.lower()
    token = (data.token or "").strip()
    url = (data.endpoint_url or "").strip()

    if prov in ["ibm", "ibm_quantum"]:
        if not token:
            raise HTTPException(status_code=400, detail="IBM Quantum Token cannot be empty.")
        os.environ["IBM_QUANTUM_TOKEN"] = token
        _update_env_file("IBM_QUANTUM_TOKEN", token)
        adapter = IBMProviderAdapter(api_token=token)
        if not adapter.is_authenticated:
            raise HTTPException(status_code=400, detail="IBM Quantum Token authentication failed. Please check your IBM Cloud API Key.")
    elif prov in ["rigetti", "rigetti_quantum"]:
        if not token:
            raise HTTPException(status_code=400, detail="Rigetti API Key cannot be empty.")
        os.environ["RIGETTI_API_KEY"] = token
        os.environ["QCS_API_KEY"] = token
        _update_env_file("RIGETTI_API_KEY", token)
        adapter = RigettiProviderAdapter(api_key=token)
    elif prov in ["ionq", "ionq_quantum"]:
        if not token:
            raise HTTPException(status_code=400, detail="IonQ API Key cannot be empty.")
        os.environ["IONQ_API_KEY"] = token
        _update_env_file("IONQ_API_KEY", token)
        adapter = IonQProviderAdapter(api_key=token)
    elif prov in ["cdac", "cdac_quantum", "onprem"]:
        if not url:
            raise HTTPException(status_code=400, detail="On-premise / C-DAC endpoint URL cannot be empty.")
        os.environ["ONPREM_QPU_URL"] = url
        _update_env_file("ONPREM_QPU_URL", url)
        adapter = OnPremiseProviderAdapter(endpoint_url=url)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {data.provider_id}")

    # Synchronize live telemetry
    collector = TelemetryCollector(db, provider_adapter=adapter)
    collector.run_full_collection_cycle()

    backends = adapter.discover_backends()
    b_names = ", ".join([b["backend_name"] for b in backends]) if backends else "Synchronized"
    return {
        "status": "SUCCESS",
        "provider_id": prov,
        "message": f"Credentials saved and verified! Discovered {len(backends)} backends ({b_names})."
    }

@router.get("/data-sources", response_model=List[ProviderResponse])
def get_data_sources(db: Session = Depends(get_db)):
    return db.query(ProviderModel).all()

@router.get("/collection-schedules")
def get_schedules(db: Session = Depends(get_db)):
    schedules = db.query(CollectionScheduleModel).all()
    if not schedules:
        defaults = [
            {"category": "Backend status", "interval_seconds": 120, "enabled": True},
            {"category": "Queue information", "interval_seconds": 60, "enabled": True},
            {"category": "Backend properties", "interval_seconds": 600, "enabled": True},
            {"category": "Calibration information", "interval_seconds": 600, "enabled": True},
            {"category": "Connectivity/configuration", "interval_seconds": 3600, "enabled": True},
            {"category": "Job status", "interval_seconds": 30, "enabled": True}
        ]
        for d in defaults:
            db.add(CollectionScheduleModel(**d))
        db.commit()
        schedules = db.query(CollectionScheduleModel).all()
    return schedules

@router.put("/collection-schedules")
def update_schedule(s: ScheduleUpdateSchema, db: Session = Depends(get_db)):
    sched = db.query(CollectionScheduleModel).filter(CollectionScheduleModel.category == s.category).first()
    if not sched:
        sched = CollectionScheduleModel(category=s.category, interval_seconds=s.interval_seconds, enabled=s.enabled)
        db.add(sched)
    else:
        sched.interval_seconds = s.interval_seconds
        sched.enabled = s.enabled
    db.commit()
    return {"message": "Schedule updated successfully", "category": s.category}

@router.get("/alert-rules", response_model=List[AlertRuleSchema])
def get_alert_rules(db: Session = Depends(get_db)):
    rules = db.query(AlertRuleModel).all()
    if not rules:
        defaults = [
            {"rule_id": "rule_t1", "metric_name": "T1", "operator": "<", "threshold_value": 40.0, "severity": "CRITICAL", "enabled": True, "description": "T1 coherence time drops below critical threshold"},
            {"rule_id": "rule_t2", "metric_name": "T2", "operator": "<", "threshold_value": 30.0, "severity": "CRITICAL", "enabled": True, "description": "T2 coherence time drops below critical threshold"},
            {"rule_id": "rule_ro", "metric_name": "READOUT_ERROR", "operator": ">", "threshold_value": 0.08, "severity": "WARNING", "enabled": True, "description": "Readout error exceeds acceptable upper bound"},
            {"rule_id": "rule_queue", "metric_name": "QUEUE_JOBS", "operator": ">", "threshold_value": 50.0, "severity": "WARNING", "enabled": True, "description": "Pending queue length exceeds threshold"},
            {"rule_id": "rule_calib", "metric_name": "CALIBRATION_AGE", "operator": ">", "threshold_value": 24.0, "severity": "WARNING", "enabled": True, "description": "Calibration age exceeds 24 hours"}
        ]
        for r in defaults:
            db.add(AlertRuleModel(**r))
        db.commit()
        rules = db.query(AlertRuleModel).all()
    return rules

@router.post("/alert-rules", response_model=AlertRuleSchema)
def create_alert_rule(rule_in: AlertRuleCreateSchema, db: Session = Depends(get_db)):
    """Allows administrators to dynamically create new alert & health monitoring rules."""
    metric = rule_in.metric_name.strip().upper()
    rule_id = (rule_in.rule_id or f"rule_{metric.lower()}_{uuid.uuid4().hex[:4]}").strip().replace(" ", "_")
    
    existing = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rule_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Alert rule with ID '{rule_id}' already exists.")

    rule = AlertRuleModel(
        rule_id=rule_id,
        metric_name=metric,
        operator=rule_in.operator.strip(),
        threshold_value=rule_in.threshold_value,
        severity=rule_in.severity.strip().upper(),
        enabled=rule_in.enabled,
        description=rule_in.description or f"Trigger alert when {metric} {rule_in.operator} {rule_in.threshold_value}"
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.put("/alert-rules/{rule_id}", response_model=AlertRuleSchema)
def update_alert_rule(rule_id: str, update_in: AlertRuleUpdateSchema, db: Session = Depends(get_db)):
    rule = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Alert rule '{rule_id}' not found.")
    
    if update_in.metric_name is not None:
        rule.metric_name = update_in.metric_name.strip().upper()
    if update_in.operator is not None:
        rule.operator = update_in.operator.strip()
    if update_in.threshold_value is not None:
        rule.threshold_value = update_in.threshold_value
    if update_in.severity is not None:
        rule.severity = update_in.severity.strip().upper()
    if update_in.enabled is not None:
        rule.enabled = update_in.enabled
    if update_in.description is not None:
        rule.description = update_in.description

    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/alert-rules/{rule_id}")
def delete_alert_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Alert rule '{rule_id}' not found.")
    db.delete(rule)
    db.commit()
    return {"status": "SUCCESS", "message": f"Alert rule '{rule_id}' deleted successfully."}

@router.post("/auto-discover")
def trigger_hardware_auto_discovery(db: Session = Depends(get_db)):
    """Triggers autonomous hardware and environment discovery."""
    from app.discovery.hardware_discovery import HardwareDiscoveryEngine
    result = HardwareDiscoveryEngine.run_auto_discovery(db)
    return result
