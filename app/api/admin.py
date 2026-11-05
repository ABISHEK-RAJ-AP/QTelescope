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
from app.core.provenance import (
    MOCK_BACKEND_IDS,
    database_storage_mode,
    platform_data_mode,
    utcnow_iso,
)
from app.services.collector_health import list_provider_health, load_all as load_collector_health
from app.core.rbac import require_admin
from app.jobs.telemetry_retention import retention_policy, run_telemetry_retention
from app.core.rbac_audit import rbac_audit_report
from app.providers.catalog import (
    CATALOG, BY_ID, upsert_stored, stored_configured, public_extra,
)
from app.providers.truth import provider_truth_label, truth_help
from app.providers.live_harness import run_live_verification
from app.services.collector_dlq import list_failures as list_collector_dlq
from app.services.circuit_breaker import snapshot as circuit_snapshot
from app.facility.mqtt_boundary import mqtt_ingest_status
from app.core.deployment import deployment_profile

router = APIRouter(prefix="/admin", tags=["Administration"])

class IbmTokenSchema(BaseModel):
    token: str

class GenericCredentialSchema(BaseModel):
    provider_id: str
    token: Optional[str] = None
    endpoint_url: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None

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

def _env_configured(env_key: Optional[str], extra_paths: Optional[list] = None) -> bool:
    if env_key and (getattr(settings, env_key, "") or os.getenv(env_key, "")):
        return True
    for path in extra_paths or []:
        if os.path.exists(os.path.expanduser(path)):
            return True
    return False


@router.get("/credentials")
def get_configured_credentials():
    """Catalog + configured flags. Never returns secret values."""
    live_flags = {
        "ibm_quantum": _env_configured("IBM_QUANTUM_TOKEN", ["~/.qiskit/qiskit-ibm.json"]),
        # Public QCS ISA needs no key; optional token still counts as configured.
        "rigetti_quantum": True,
        "ionq_quantum": _env_configured("IONQ_API_KEY"),
        "cdac_quantum": _env_configured("ONPREM_QPU_URL"),
    }
    providers = []
    payload = {}
    for item in CATALOG:
        pid = item["id"]
        configured = bool(live_flags.get(pid) or stored_configured(pid))
        truth = provider_truth_label(item, configured=configured)
        entry = {
            **item,
            "is_configured": configured,
            "adapter_status": "LIVE" if item["adapter"] == "live" else "STUB",
            "truth_label": truth,
            "truth_help": truth_help(truth),
            "public_fields": public_extra(pid, item["fields"]),
        }
        if pid == "cdac_quantum":
            entry["endpoint_url"] = settings.ONPREM_QPU_URL or public_extra(pid, item["fields"]).get("endpoint_url", "")
        providers.append(entry)
        payload[pid] = {
            "name": item["name"],
            "is_configured": configured,
            "credential_type": item["credential_type"],
            "adapter_status": entry["adapter_status"],
        }
    payload["providers"] = providers
    return payload

def _env_credential_write_allowed() -> bool:
    from app.core.env_profile import env_flag, is_production_profile

    # Prod defaults OFF; lab defaults ON for convenience unless explicitly set.
    return env_flag("ALLOW_ENV_CREDENTIAL_WRITE", default=not is_production_profile())


def _update_env_file(key: str, value: str):
    if not _env_credential_write_allowed():
        return
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

@router.get("/rbac-audit")
def get_rbac_audit():
    return rbac_audit_report()


@router.get("/adapters/verification")
def get_adapter_verification(_: str = Depends(require_admin)):
    return {"results": run_live_verification(), "note": "Skipped when cloud tokens absent."}


@router.get("/collector-dlq")
def get_collector_dlq(limit: int = 50, _: str = Depends(require_admin)):
    return {
        "failures": list_collector_dlq(limit=limit),
        "circuit_breakers": circuit_snapshot(),
    }


@router.get("/facility/mqtt-status")
def get_facility_mqtt_status():
    return mqtt_ingest_status()


@router.post("/ibm-token")
def save_ibm_token(
    data: IbmTokenSchema,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
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
def save_provider_credentials(
    data: GenericCredentialSchema,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
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
        if token:
            os.environ["RIGETTI_API_KEY"] = token
            os.environ["QCS_API_KEY"] = token
            _update_env_file("RIGETTI_API_KEY", token)
        adapter = RigettiProviderAdapter(api_key=token or None)
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
        if prov not in BY_ID:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {data.provider_id}")
        spec = BY_ID[prov]
        if spec["adapter"] == "live":
            raise HTTPException(status_code=400, detail=f"Live adapter '{prov}' missing required token/url.")
        needs_token = any(f.get("in") == "token" and f.get("required", True) for f in spec["fields"])
        needs_url = any(f.get("in") == "endpoint_url" and f.get("required", True) for f in spec["fields"])
        if needs_token and not token and not stored_configured(prov):
            raise HTTPException(status_code=400, detail=f"{spec['name']} token cannot be empty.")
        if needs_url and not url and not stored_configured(prov):
            raise HTTPException(status_code=400, detail=f"{spec['name']} endpoint URL cannot be empty.")
        upsert_stored(prov, token, url, data.extra)
        return {
            "status": "STUB",
            "provider_id": prov,
            "message": f"{spec['name']} credentials stored. Live poll adapter not installed — slot is STUB until wired.",
        }

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

@router.get("/retention/policy")
def get_retention_policy():
    return retention_policy()


@router.post("/retention/run")
def run_retention_job(
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    deleted = run_telemetry_retention(db)
    return {"status": "SUCCESS", "deleted_rows": deleted, "policy": retention_policy()}


@router.get("/scheduler-status")
def get_scheduler_status(db: Session = Depends(get_db)):
    from app.workers.collection_scheduler import scheduler_enabled, TICK_SECONDS

    schedules = db.query(CollectionScheduleModel).all()
    return {
        "enabled": scheduler_enabled(),
        "tick_seconds": TICK_SECONDS,
        "schedules": [
            {
                "category": s.category,
                "interval_seconds": s.interval_seconds,
                "enabled": s.enabled,
                "last_run": s.last_run.isoformat() if s.last_run else None,
            }
            for s in schedules
        ],
    }


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
def update_schedule(
    s: ScheduleUpdateSchema,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
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
def create_alert_rule(
    rule_in: AlertRuleCreateSchema,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
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
def update_alert_rule(
    rule_id: str,
    update_in: AlertRuleUpdateSchema,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
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
def delete_alert_rule(rule_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    rule = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Alert rule '{rule_id}' not found.")
    db.delete(rule)
    db.commit()
    return {"status": "SUCCESS", "message": f"Alert rule '{rule_id}' deleted successfully."}

@router.get("/collector-health")
def get_collector_health():
    """Per-provider collection status, duration, errors, last success."""
    blob = load_collector_health()
    return {
        "updated_at": blob.get("updated_at"),
        "providers": list_provider_health(),
    }


@router.get("/deployment/profile")
def get_deployment_profile():
    """On-prem / air-gap vs connected deployment capabilities."""
    return deployment_profile()


@router.get("/provenance")
def get_platform_provenance(db: Session = Depends(get_db)):
    """Platform-wide data lineage: mock flag, DB mode, collectors, latest measurement."""
    ensure_discovered(db)
    backends = db.query(BackendModel).all()
    live_ids = [b.backend_id for b in backends if b.backend_id not in MOCK_BACKEND_IDS]
    latest = (
        db.query(BackendTelemetryModel)
        .order_by(BackendTelemetryModel.timestamp.desc())
        .first()
    )
    mock_enabled = settings.ENABLE_MOCK_DATA
    return {
        "generated_at": utcnow_iso(),
        "project_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "enable_mock_data": mock_enabled,
        "database_storage": database_storage_mode(settings.DATABASE_URL),
        "platform_data_mode": platform_data_mode(mock_enabled, bool(live_ids)),
        "backend_counts": {
            "total": len(backends),
            "simulated_catalog_ids": sum(1 for b in backends if b.backend_id in MOCK_BACKEND_IDS),
            "non_mock_ids": len(live_ids),
        },
        "latest_backend_telemetry": {
            "backend_id": latest.backend_id if latest else None,
            "telemetry_source": latest.telemetry_source if latest else None,
            "collected_at": latest.timestamp.isoformat() if latest and latest.timestamp else None,
            "data_quality": latest.data_quality if latest else None,
        },
        "collectors": list_provider_health(),
        "disclaimer": (
            "simulated:* telemetry is not vendor QPU measurement; "
            "live:* is from provider APIs when credentials and discovery succeed."
        ),
    }


@router.post("/auto-discover")
def trigger_hardware_auto_discovery(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    """Triggers autonomous hardware and environment discovery."""
    from app.discovery.hardware_discovery import HardwareDiscoveryEngine
    result = HardwareDiscoveryEngine.run_auto_discovery(db)
    return result


@router.post("/run-collection")
def trigger_collection_run(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    """Manual full fleet collection (same as auto-discover)."""
    return trigger_hardware_auto_discovery(db)


@router.delete("/collector-dlq")
def purge_collector_dlq(_: str = Depends(require_admin)):
    """Clear persisted collector failure log (local JSONL)."""
    from app.services.collector_dlq import purge_failures

    n = purge_failures()
    return {"status": "SUCCESS", "entries_removed": n}
