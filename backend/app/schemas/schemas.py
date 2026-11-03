import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Provider Schemas
class ProviderBase(BaseModel):
    provider_id: str
    provider_name: str
    provider_type: str
    status: str = "active"
    config_json: Optional[Dict[str, Any]] = None

class ProviderResponse(ProviderBase):
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# Backend Schemas
class BackendBase(BaseModel):
    backend_id: str
    provider_id: str
    backend_name: str
    backend_type: str
    qpu_modality: Optional[str] = "superconducting"
    topology_type: Optional[str] = "fixed_graph"
    qubit_count: int
    operational_status: str
    status_message: Optional[str] = None
    configuration_version: Optional[str] = None
    quantum_volume: Optional[int] = None
    clops: Optional[int] = None
    basis_gates: Optional[List[str]] = None
    modality_extensions: Optional[Dict[str, Any]] = None

class BackendResponse(BackendBase):
    created_at: datetime.datetime
    updated_at: datetime.datetime
    class Config:
        from_attributes = True

class BackendStatusResponse(BaseModel):
    backend_id: str
    backend_name: str
    operational_status: str
    status_message: Optional[str]
    pending_jobs: int
    estimated_wait_time: Optional[float]
    updated_at: datetime.datetime

# Qubit & Gate Schemas
class QubitDetailResponse(BaseModel):
    qubit_id: str
    backend_id: str
    qubit_index: int
    status: str
    latest_t1: Optional[float] = None
    latest_t2: Optional[float] = None
    latest_frequency: Optional[float] = None
    latest_readout_error: Optional[float] = None
    modality_metrics: Optional[Dict[str, Any]] = None
    health_status: str = "Healthy"
    source_timestamp: Optional[datetime.datetime] = None


class GateDetailResponse(BaseModel):
    gate_id: str
    backend_id: str
    gate_name: str
    gate_type: str
    qubits: List[int]
    gate_error: Optional[float] = None
    gate_duration: Optional[float] = None # ns

class ConnectivityEdgeResponse(BaseModel):
    edge_id: str
    backend_id: str
    source_qubit: int
    target_qubit: int

# Calibration Schemas
class CalibrationSnapshotResponse(BaseModel):
    id: int
    timestamp: datetime.datetime
    backend_id: str
    calibration_timestamp: datetime.datetime
    calibration_identifier: str
    calibration_age: float
    freshness_status: str
    metrics_summary: Optional[Dict[str, Any]] = None

# Drift Schemas
class ParameterDriftPoint(BaseModel):
    timestamp: datetime.datetime
    current_value: Optional[float]
    previous_value: Optional[float]
    abs_change: Optional[float]
    pct_change: Optional[float]
    change_direction: str # INCREASING, DECREASING, STABLE
    rate_of_change: Optional[float]
    rolling_avg: Optional[float]
    rolling_std_dev: Optional[float]
    drift_status: str # NORMAL, DRIFTING, CRITICAL_DRIFT

class MetricDriftSummary(BaseModel):
    backend_id: str
    qubit_index: Optional[int] = None
    metric_name: str
    latest_val: Optional[float]
    previous_val: Optional[float]
    abs_change: Optional[float]
    pct_change: Optional[float]
    drift_status: str
    points: List[ParameterDriftPoint]

# Queue Schemas
class QueueStatusResponse(BaseModel):
    backend_id: str
    backend_name: str
    pending_jobs: int
    estimated_wait_time: Optional[float]
    queue_condition: str # OPTIMAL, MODERATE, BUSY, CONGESTED
    trend: str # RISING, FALLING, STABLE
    operational_status: Optional[str] = "ONLINE"
    provider_id: Optional[str] = None
    qubit_count: Optional[int] = None

class QueueHistoryPoint(BaseModel):
    timestamp: datetime.datetime
    pending_jobs: int
    estimated_wait_time: Optional[float]

# Job Execution Schemas
class JobRecordResponse(BaseModel):
    job_id: str
    backend_id: str
    status: str
    submitted_at: datetime.datetime
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    runtime: Optional[float] = None
    failure_reason: Optional[str] = None
    calibration_identifier: Optional[str] = None
    tags: Optional[List[str]] = None

# Resource Health Schemas
class ContributingFactor(BaseModel):
    name: str
    status: str # HEALTHY, WARNING, CRITICAL, UNKNOWN
    description: str
    value: Optional[Any] = None

class BackendHealthResponse(BaseModel):
    backend_id: str
    backend_name: str
    overall_health: str # HEALTHY, DEGRADED, CRITICAL, UNKNOWN
    health_score: float # 0.0 - 100.0
    contributing_factors: List[ContributingFactor]

class QubitHealthSummary(BaseModel):
    backend_id: str
    qubit_index: int
    status: str # Healthy, Warning, Degraded, Unavailable, Unknown
    t1_status: str
    t2_status: str
    readout_status: str

# Alert Schemas
class AlertResponse(BaseModel):
    alert_id: str
    resource_type: str
    resource_id: str
    backend_id: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    current_value: Optional[float]
    threshold_value: Optional[float]
    detected_at: datetime.datetime
    status: str
    acknowledged_by: Optional[str]
    resolved_at: Optional[datetime.datetime]


class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: str = "admin"

# Admin & Settings Schemas
class ScheduleUpdateSchema(BaseModel):
    category: str
    interval_seconds: int
    enabled: bool

class AlertRuleSchema(BaseModel):
    rule_id: str
    metric_name: str
    operator: str
    threshold_value: float
    severity: str
    enabled: bool
    description: Optional[str] = None

class AlertRuleCreateSchema(BaseModel):
    rule_id: Optional[str] = None
    metric_name: str
    operator: str
    threshold_value: float
    severity: str = "WARNING"
    enabled: bool = True
    description: Optional[str] = None

class AlertRuleUpdateSchema(BaseModel):
    metric_name: Optional[str] = None
    operator: Optional[str] = None
    threshold_value: Optional[float] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    total_backends: int
    operational_backends: int
    unavailable_backends: int
    total_qubits: int
    stale_calibration_count: int
    active_alerts_count: int
    total_pending_jobs: int
    recent_collection_status: str
