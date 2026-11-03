"""Build workspace (studio) — extensible projects, circuits, simulation."""
import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


class DevProjectModel(Base):
    __tablename__ = "dev_projects"

    project_id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, default="default", index=True)
    slug = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    project_type = Column(String, nullable=False, default="quantum_circuit")
    template_id = Column(String, nullable=True)
    owner_username = Column(String, nullable=False, index=True)
    # Open-ended user / site customization (editor, sim defaults, UI, integrations)
    settings_json = Column(JSON, nullable=False, default=dict)
    # Feature toggles per project (keys from studio platform catalog)
    capabilities_json = Column(JSON, nullable=False, default=dict)
    tags_json = Column(JSON, nullable=False, default=list)
    metadata_json = Column(JSON, nullable=False, default=dict)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    members = relationship("DevProjectMemberModel", back_populates="project", cascade="all, delete-orphan")
    circuits = relationship("CircuitVersionModel", back_populates="project", cascade="all, delete-orphan")


class DevProjectMemberModel(Base):
    __tablename__ = "dev_project_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    username = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="editor")
    created_at = Column(DateTime, default=_utcnow)

    project = relationship("DevProjectModel", back_populates="members")


class DevProjectRevisionModel(Base):
    __tablename__ = "dev_project_revisions"

    revision_id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    snapshot_json = Column(JSON, nullable=False, default=dict)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)


class CircuitVersionModel(Base):
    __tablename__ = "circuit_versions"

    circuit_id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    source_language = Column(String, nullable=False, default="openqasm3")
    content_hash = Column(String, nullable=False)
    source_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=False, default=dict)
    is_head = Column(Boolean, default=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    project = relationship("DevProjectModel", back_populates="circuits")


class SimulationJobModel(Base):
    __tablename__ = "simulation_jobs"

    job_id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    circuit_id = Column(String, ForeignKey("circuit_versions.circuit_id"), nullable=False)
    workload_id = Column(String, nullable=True, index=True)
    execution_target_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="queued")
    shots = Column(Integer, nullable=False, default=1024)
    seed = Column(Integer, nullable=True)
    parameters_json = Column(JSON, nullable=False, default=dict)
    result_json = Column(JSON, nullable=True)
    manifest_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)


class WorkloadModel(Base):
    __tablename__ = "workloads"

    workload_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, default="default", index=True)
    project_id = Column(String, nullable=True, index=True)
    state = Column(String, nullable=False, default="draft")
    title = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=False, default=dict)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class CompilationRunModel(Base):
    __tablename__ = "compilation_runs"

    run_id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    circuit_id = Column(String, ForeignKey("circuit_versions.circuit_id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="queued")
    transpile_config_json = Column(JSON, nullable=False, default=dict)
    diagnostics_json = Column(JSON, nullable=False, default=list)
    compiled_artifact_json = Column(JSON, nullable=True)
    tool = Column(String, nullable=True)
    tool_version = Column(String, nullable=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)


class PreflightReportModel(Base):
    __tablename__ = "preflight_reports"

    report_id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    circuit_id = Column(String, ForeignKey("circuit_versions.circuit_id"), nullable=False, index=True)
    execution_target_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="running")
    violations_json = Column(JSON, nullable=False, default=list)
    metrics_json = Column(JSON, nullable=False, default=dict)
    execution_class = Column(String, nullable=False, default="simulated")
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)


class DevExperimentReportModel(Base):
    __tablename__ = "dev_experiment_reports"

    report_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, default="default", index=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    format = Column(String, nullable=False, default="html")
    content_html = Column(Text, nullable=True)
    manifest_json = Column(JSON, nullable=False, default=dict)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)


class ApprovalRecordModel(Base):
    __tablename__ = "approval_records"

    record_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, default="default", index=True)
    workload_id = Column(String, ForeignKey("workloads.workload_id"), nullable=False, index=True)
    submission_id = Column(String, ForeignKey("workload_submissions.submission_id"), nullable=False, index=True)
    stage_id = Column(String, nullable=True)
    decision = Column(String, nullable=False)
    actor_username = Column(String, nullable=False)
    policy_id = Column(String, nullable=True)
    policy_version = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class WorkloadSubmissionModel(Base):
    __tablename__ = "workload_submissions"

    submission_id = Column(String, primary_key=True)
    workload_id = Column(String, ForeignKey("workloads.workload_id"), nullable=False, index=True)
    tenant_id = Column(String, nullable=False, default="default", index=True)
    project_id = Column(String, ForeignKey("dev_projects.project_id"), nullable=False, index=True)
    circuit_id = Column(String, nullable=True)
    compilation_run_id = Column(String, nullable=True)
    preflight_report_id = Column(String, nullable=True)
    package_sha256 = Column(String, nullable=False)
    manifest_json = Column(JSON, nullable=False, default=dict)
    governance_state = Column(String, nullable=False, default="draft")
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class RegistryTimelineEventModel(Base):
    __tablename__ = "registry_timeline_events"

    event_id = Column(String, primary_key=True)
    workload_id = Column(String, ForeignKey("workloads.workload_id"), nullable=False, index=True)
    source_system = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    payload_json = Column(JSON, nullable=False, default=dict)
    correlation_status = Column(String, nullable=False, default="linked")
    created_at = Column(DateTime, default=_utcnow, index=True)


class InventoryAssetModel(Base):
    __tablename__ = "inventory_assets"

    asset_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    provider_id = Column(String, nullable=False, index=True)
    native_asset_id = Column(String, nullable=False)
    asset_class = Column(String, nullable=False)
    execution_class = Column(String, nullable=False)
    provenance = Column(String, nullable=False, default="manual")
    lifecycle_state = Column(String, nullable=False, default="registered", index=True)
    created_at = Column(DateTime, default=_utcnow)


class ProviderManifestModel(Base):
    __tablename__ = "provider_manifests"

    manifest_id = Column(String, primary_key=True)
    provider_id = Column(String, nullable=False, index=True)
    operations_json = Column(JSON, nullable=False, default=list)
    execution_classes_json = Column(JSON, nullable=False, default=list)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)


class DispatchAttemptModel(Base):
    __tablename__ = "dispatch_attempts"

    attempt_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    workload_id = Column(String, ForeignKey("workloads.workload_id"), nullable=False, index=True)
    idempotency_key = Column(String, nullable=False)
    execution_class = Column(String, nullable=False)
    backend_id = Column(String, nullable=True)
    dispatch_state = Column(String, nullable=False, default="dispatch_attempted")
    external_job_id = Column(String, nullable=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    __table_args__ = (UniqueConstraint("tenant_id", "idempotency_key", name="uq_dispatch_attempt_idempotency"),)


class MeterSampleModel(Base):
    __tablename__ = "meter_samples"

    sample_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    dimension = Column(String, nullable=False, index=True)
    metric = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=True)
    unit = Column(String, nullable=False)
    availability = Column(String, nullable=False, default="available")
    source_time = Column(DateTime, nullable=False, default=_utcnow)
    ingested_at = Column(DateTime, default=_utcnow)
    connector_id = Column(String, nullable=False, default="unknown")


class VirtualResourcePoolModel(Base):
    __tablename__ = "virtual_resource_pools"

    pool_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class VirtualResourcePoolMemberModel(Base):
    __tablename__ = "virtual_resource_pool_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pool_id = Column(String, ForeignKey("virtual_resource_pools.pool_id"), nullable=False, index=True)
    asset_id = Column(String, nullable=False, index=True)
    added_at = Column(DateTime, default=_utcnow)

    __table_args__ = (UniqueConstraint("pool_id", "asset_id", name="uq_pool_asset"),)
