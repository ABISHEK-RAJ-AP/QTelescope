import datetime
from sqlalchemy.orm import Session
from app.providers.ibm_adapter import IBMProviderAdapter
from app.normalizers.telemetry_normalizer import TelemetryNormalizer
from app.monitoring.freshness import CalibrationFreshnessMonitor
from app.monitoring.health_engine import HealthEngine
from app.alerts.alert_engine import AlertEngine
from app.core.provenance import infer_collection_lineage
from app.models.entities import (
    ProviderModel, BackendModel, QubitModel, GateModel, ConnectivityEdgeModel,
    BackendTelemetryModel, QubitTelemetryModel, GateTelemetryModel,
    CalibrationSnapshotModel, JobRecordModel, AlertModel
)
from app.services.backend_purge import purge_backend

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class TelemetryCollector:
    """
    Coordinates data collection from provider adapters, runs normalizers,
    computes freshness and health, checks alert rules, and persists multi-hardware telemetry.
    """
    def __init__(self, db: Session, provider_adapter=None):
        self.db = db
        self.adapter = provider_adapter or IBMProviderAdapter()

    def run_full_collection_cycle(self):
        # Infer provider identity from adapter
        adapter_cls = self.adapter.__class__.__name__
        if "Rigetti" in adapter_cls:
            prov_id, prov_name, prov_type = "rigetti_quantum", "Rigetti Computing", "rigetti"
        elif "IonQ" in adapter_cls:
            prov_id, prov_name, prov_type = "ionq_quantum", "IonQ Trapped-Ion", "ionq"
        elif "OnPremise" in adapter_cls:
            prov_id, prov_name, prov_type = "cdac_quantum", "C-DAC Quantum Platform", "cdac"
        else:
            prov_id, prov_name, prov_type = "ibm_quantum", "IBM Quantum Platform", "ibm"

        # 1. Ensure Provider record
        provider = self.db.query(ProviderModel).filter(ProviderModel.provider_id == prov_id).first()
        if not provider:
            provider = ProviderModel(
                provider_id=prov_id,
                provider_name=prov_name,
                provider_type=prov_type,
                status="active"
            )
            self.db.add(provider)
            self.db.commit()

        # 2. Backend Discovery
        backends = self.adapter.discover_backends()
        lineage = infer_collection_lineage(backends)
        self._last_lineage = lineage
        for b in backends:
            modality = b.get("qpu_modality") or ("trapped_ion" if "ionq" in b["backend_id"] else ("simulator" if b["backend_type"] == "simulator" else "superconducting"))
            topology = b.get("topology_type") or ("all_to_all" if modality == "trapped_ion" else "fixed_graph")

            existing = self.db.query(BackendModel).filter(BackendModel.backend_id == b["backend_id"]).first()
            if not existing:
                backend_record = BackendModel(
                    backend_id=b["backend_id"],
                    provider_id=prov_id,
                    backend_name=b["backend_name"],
                    backend_type=b["backend_type"],
                    qpu_modality=modality,
                    topology_type=topology,
                    qubit_count=b["qubit_count"],
                    operational_status=b["operational_status"],
                    status_message=b.get("status_message"),
                    configuration_version=b.get("configuration_version"),
                    quantum_volume=b.get("quantum_volume"),
                    clops=b.get("clops"),
                    basis_gates=b.get("basis_gates"),
                    modality_extensions=b.get("modality_extensions")
                )
                self.db.add(backend_record)
                self.db.commit()
                
                # Seed Qubits and Connectivity
                for q_idx in range(b["qubit_count"]):
                    self.db.add(QubitModel(
                        qubit_id=f"{b['backend_id']}_Q{q_idx}",
                        backend_id=b["backend_id"],
                        qubit_index=q_idx,
                        status="OPERATIONAL"
                    ))
                self.db.commit()
                
                # Seed topology edges
                edges = self.adapter.get_connectivity(b["backend_id"])
                for e in edges:
                    if "qubits" in e and len(e["qubits"]) >= 2:
                        q_src, q_tgt = e["qubits"][0], e["qubits"][1]
                    else:
                        q_src = e.get("source_qubit", 0)
                        q_tgt = e.get("target_qubit", 1)

                    edge_key = e.get("edge_id", f"{b['backend_id']}_{q_src}_{q_tgt}")
                    self.db.add(ConnectivityEdgeModel(
                        edge_id=edge_key,
                        backend_id=b["backend_id"],
                        source_qubit=q_src,
                        target_qubit=q_tgt
                    ))
                self.db.commit()

        # Prune stale or disabled mock backends for this provider
        discovered_ids = [b["backend_id"] for b in backends]
        stale_backends = self.db.query(BackendModel).filter(
            BackendModel.provider_id == prov_id,
            ~BackendModel.backend_id.in_(discovered_ids)
        ).all()
        for sb in stale_backends:
            purge_backend(self.db, sb.backend_id)
        self.db.commit()

        # 3. Collect Telemetry for discovered Backends
        for b in backends:
            backend_id = b["backend_id"]
            # Backend Status & Queue
            status_raw = self.adapter.get_backend_status(backend_id)
            status_norm = TelemetryNormalizer.normalize_backend_status(
                status_raw, provider_id=prov_id, lineage=lineage
            )
            self.db.add(BackendTelemetryModel(**status_norm))

            # Backend Properties & Calibration
            props_raw = self.adapter.get_backend_properties(backend_id)
            calib_time = props_raw.get("calibration_timestamp", utcnow())
            if isinstance(calib_time, str):
                try:
                    calib_time = datetime.datetime.fromisoformat(calib_time.replace("Z", "+00:00"))
                except Exception:
                    calib_time = utcnow()

            age_hrs, freshness = CalibrationFreshnessMonitor.calculate_freshness(calib_time)

            # Store Calibration Snapshot
            calib_snap = CalibrationSnapshotModel(
                timestamp=utcnow(),
                backend_id=backend_id,
                calibration_timestamp=calib_time,
                calibration_identifier=props_raw.get("calibration_identifier", f"calib_{backend_id}"),
                calibration_age=age_hrs,
                freshness_status=freshness,
                metrics_summary={
                    "qubits_count": len(props_raw.get("qubits", [])),
                    "fridge_temperature_mK": (props_raw.get("general_properties") or {}).get("fridge_temperature_mK"),
                }
            )
            self.db.add(calib_snap)

            # Qubits Telemetry
            qubits_norm = []
            for q_raw in props_raw.get("qubits", []):
                q_norm = TelemetryNormalizer.normalize_qubit_metric(q_raw, backend_id)
                self.db.add(QubitTelemetryModel(**q_norm))
                qubits_norm.append(q_norm)
                
                # Update QubitModel with latest modality_metrics
                if q_norm.get("modality_metrics"):
                    q_entity = self.db.query(QubitModel).filter(
                        QubitModel.backend_id == backend_id,
                        QubitModel.qubit_index == q_norm["qubit_index"]
                    ).first()
                    if q_entity:
                        q_entity.modality_metrics = q_norm["modality_metrics"]

            # Gates Telemetry
            for g_raw in props_raw.get("gates", []):
                g_norm = TelemetryNormalizer.normalize_gate_metric(g_raw, backend_id)
                self.db.add(GateTelemetryModel(**g_norm))

            # Job Records
            valid_job_fields = {"job_id", "backend_id", "status", "submitted_at", "started_at", "completed_at", "runtime", "failure_reason", "calibration_identifier", "tags", "created_at"}
            jobs_raw = self.adapter.get_jobs(backend_id, limit=8)
            for j_raw in jobs_raw:
                job_data = {k: v for k, v in j_raw.items() if k in valid_job_fields}
                for date_key in ["submitted_at", "started_at", "completed_at", "created_at"]:
                    val = job_data.get(date_key)
                    if isinstance(val, str):
                        try:
                            job_data[date_key] = datetime.datetime.fromisoformat(val.replace("Z", "+00:00"))
                        except Exception:
                            job_data[date_key] = utcnow()

                if not job_data.get("submitted_at"):
                    job_data["submitted_at"] = utcnow()

                existing_job = self.db.query(JobRecordModel).filter(JobRecordModel.job_id == job_data["job_id"]).first()
                if not existing_job:
                    self.db.add(JobRecordModel(**job_data))
                else:
                    existing_job.status = job_data.get("status", existing_job.status)
                    existing_job.runtime = job_data.get("runtime", existing_job.runtime)


            # Check Alert Rules
            active_alerts = self.db.query(AlertModel).filter(AlertModel.status == "ACTIVE").all()
            triggered = AlertEngine.evaluate_telemetry(
                backend_id=backend_id,
                operational=status_norm["operational"],
                pending_jobs=status_norm["pending_jobs"],
                calibration_freshness=freshness,
                calibration_age_hours=age_hrs,
                qubits_telemetry=qubits_norm,
                existing_active_alerts=active_alerts
            )
            for new_alt in triggered:
                self.db.add(new_alt)

        self.db.commit()
        self._last_cycle_stats = {
            "backends_processed": len(backends),
            "backend_telemetry_rows": len(backends),
            "calibration_snapshots": len(backends),
            "provider_id": prov_id,
        }
        try:
            from app.core.cache import invalidate_operational_cache

            invalidate_operational_cache()
        except Exception:
            pass
        try:
            from app.services.incident_service import sync_incidents_from_alerts
            sync_incidents_from_alerts(self.db)
        except Exception:
            pass
