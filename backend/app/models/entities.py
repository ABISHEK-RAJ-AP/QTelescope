import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class ProviderModel(Base):
    __tablename__ = "providers"
    
    provider_id = Column(String, primary_key=True, index=True)
    provider_name = Column(String, nullable=False)
    provider_type = Column(String, nullable=False) # ibm, rigetti, ionq, cdac, simulator
    status = Column(String, default="active")
    config_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class BackendModel(Base):
    __tablename__ = "backends"
    
    backend_id = Column(String, primary_key=True, index=True)
    provider_id = Column(String, ForeignKey("providers.provider_id"), nullable=False)
    backend_name = Column(String, nullable=False)
    backend_type = Column(String, nullable=False) # hardware, simulator
    qpu_modality = Column(String, default="superconducting") # superconducting, trapped_ion, neutral_atom, simulator
    topology_type = Column(String, default="fixed_graph") # fixed_graph, all_to_all, spatial_lattice
    qubit_count = Column(Integer, nullable=False)
    operational_status = Column(String, nullable=False) # ONLINE, OFFLINE, MAINTENANCE
    status_message = Column(String, nullable=True)
    configuration_version = Column(String, nullable=True)
    quantum_volume = Column(Integer, nullable=True)
    clops = Column(Integer, nullable=True)
    basis_gates = Column(JSON, nullable=True)
    modality_extensions = Column(JSON, nullable=True) # Vendor-specific hardware parameters
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class QubitModel(Base):
    __tablename__ = "qubits"
    
    qubit_id = Column(String, primary_key=True, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False)
    qubit_index = Column(Integer, nullable=False)
    status = Column(String, default="OPERATIONAL") # OPERATIONAL, FAULTY, DEGRADED
    modality_metrics = Column(JSON, nullable=True)

class GateModel(Base):
    __tablename__ = "gates"
    
    gate_id = Column(String, primary_key=True, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False)
    gate_name = Column(String, nullable=False)
    gate_type = Column(String, nullable=False) # 1q, 2q

class ConnectivityEdgeModel(Base):
    __tablename__ = "connectivity_edges"
    
    edge_id = Column(String, primary_key=True, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False)
    source_qubit = Column(Integer, nullable=False)
    target_qubit = Column(Integer, nullable=False)

class BackendTelemetryModel(Base):
    __tablename__ = "backend_telemetry"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False, index=True)
    operational = Column(Boolean, nullable=False)
    pending_jobs = Column(Integer, default=0)
    estimated_wait_time = Column(Float, nullable=True) # seconds
    telemetry_source = Column(String, default="api")
    data_quality = Column(String, default="VALID")

class QubitTelemetryModel(Base):
    __tablename__ = "qubit_telemetry"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False, index=True)
    qubit_index = Column(Integer, nullable=False, index=True)
    t1 = Column(Float, nullable=True) # us
    t2 = Column(Float, nullable=True) # us
    frequency = Column(Float, nullable=True) # GHz
    readout_error = Column(Float, nullable=True)
    modality_metrics = Column(JSON, nullable=True) # SPAM, Anharmonicity, etc.
    source_timestamp = Column(DateTime, nullable=True)
    data_quality = Column(String, default="VALID")

class GateTelemetryModel(Base):
    __tablename__ = "gate_telemetry"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False, index=True)
    gate_name = Column(String, nullable=False)
    qubits = Column(JSON, nullable=False) # list of qubit indices
    gate_error = Column(Float, nullable=True)
    gate_duration = Column(Float, nullable=True) # ns
    source_timestamp = Column(DateTime, nullable=True)
    data_quality = Column(String, default="VALID")

class CalibrationSnapshotModel(Base):
    __tablename__ = "calibration_snapshots"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False, index=True)
    calibration_timestamp = Column(DateTime, nullable=False)
    calibration_identifier = Column(String, nullable=False)
    calibration_age = Column(Float, nullable=False) # hours
    freshness_status = Column(String, nullable=False) # Fresh, Recent, Aging, Stale, Unknown
    metrics_summary = Column(JSON, nullable=True)

class JobRecordModel(Base):
    __tablename__ = "job_records"
    
    job_id = Column(String, primary_key=True, index=True)
    backend_id = Column(String, ForeignKey("backends.backend_id"), nullable=False, index=True)
    status = Column(String, nullable=False) # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    submitted_at = Column(DateTime, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    runtime = Column(Float, nullable=True) # seconds
    failure_reason = Column(Text, nullable=True)
    calibration_identifier = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class AlertModel(Base):
    __tablename__ = "alerts"
    
    alert_id = Column(String, primary_key=True, index=True)
    resource_type = Column(String, nullable=False) # BACKEND, QUBIT, GATE, QUEUE, CALIBRATION
    resource_id = Column(String, nullable=False)
    alert_type = Column(String, nullable=False)
    severity = Column(String, nullable=False) # INFO, WARNING, CRITICAL
    message = Column(Text, nullable=False)
    current_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    detected_at = Column(DateTime, default=utcnow)
    status = Column(String, default="ACTIVE") # ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

class CollectionScheduleModel(Base):
    __tablename__ = "collection_schedules"
    
    category = Column(String, primary_key=True) # status, queue, properties, calibration, connectivity, jobs
    interval_seconds = Column(Integer, nullable=False)
    enabled = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)

class AlertRuleModel(Base):
    __tablename__ = "alert_rules"
    
    rule_id = Column(String, primary_key=True, index=True)
    metric_name = Column(String, nullable=False) # T1, T2, READOUT_ERROR, QUEUE_JOBS, CALIBRATION_AGE
    operator = Column(String, nullable=False) # <, >, <=, >=, ==
    threshold_value = Column(Float, nullable=False)
    severity = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    description = Column(String, nullable=True)
