from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    project_type: str = Field(default="quantum_circuit")
    template_id: Optional[str] = None
    slug: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    capabilities: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    capabilities: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class ProjectMemberAdd(BaseModel):
    username: str
    role: str = "editor"


class ProjectMemberOut(BaseModel):
    username: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectOut(BaseModel):
    project_id: str
    tenant_id: str
    slug: str
    name: str
    description: Optional[str]
    project_type: str
    template_id: Optional[str]
    owner_username: str
    settings: Dict[str, Any]
    capabilities: Dict[str, Any]
    tags: List[str]
    metadata: Dict[str, Any]
    is_archived: bool
    submission_lock: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CircuitCreate(BaseModel):
    name: str = Field(default="main")
    source_language: str = Field(default="openqasm3")
    source_text: str = Field(default="")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class CircuitOut(BaseModel):
    circuit_id: str
    project_id: str
    name: str
    version_number: int
    source_language: str
    content_hash: str
    source_text: Optional[str]
    metadata: Dict[str, Any]
    is_head: bool
    created_by: str
    created_at: datetime


class SimulateRequest(BaseModel):
    execution_target_id: Optional[str] = Field(default="simulator_local")
    shots: int = Field(default=1024, ge=1, le=100000)
    seed: Optional[int] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    circuit_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class CompileRequest(BaseModel):
    optimization_level: int = Field(default=1, ge=0, le=3)
    basis_gates: Optional[List[str]] = None

    model_config = ConfigDict(extra="allow")


class CompilationRunOut(BaseModel):
    run_id: str
    project_id: str
    circuit_id: str
    status: str
    transpile_config: Dict[str, Any]
    diagnostics: List[Dict[str, Any]]
    compiled_artifact: Optional[Dict[str, Any]] = None
    tool: Optional[str] = None
    tool_version: Optional[str] = None
    created_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class EstimationRequest(BaseModel):
    execution_target_id: str = Field(default="simulator_local")
    shots: int = Field(default=1024, ge=1, le=100000)
    optimization_level: int = Field(default=1, ge=0, le=3)

    model_config = ConfigDict(extra="allow")


class EstimationOut(BaseModel):
    circuit_id: str
    feasible: bool
    execution_class: str
    diagnostics: List[Dict[str, Any]]
    metrics: Dict[str, Any]


class PreflightRequest(BaseModel):
    execution_target_id: str = Field(default="simulator_local")
    optimization_level: int = Field(default=1, ge=0, le=3)

    model_config = ConfigDict(extra="allow")


class PreflightReportOut(BaseModel):
    report_id: str
    project_id: str
    circuit_id: str
    execution_target_id: str
    status: str
    execution_class: str
    violations: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    created_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class WorkloadSubmissionCreate(BaseModel):
    project_id: str
    circuit_id: Optional[str] = None
    compilation_run_id: Optional[str] = None
    preflight_report_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class WorkloadSubmissionOut(BaseModel):
    submission_id: str
    workload_id: str
    tenant_id: str
    project_id: str
    circuit_id: Optional[str]
    compilation_run_id: Optional[str]
    preflight_report_id: Optional[str]
    package_sha256: str
    manifest: Dict[str, Any]
    governance_state: str
    governance_progress: Optional[Dict[str, Any]] = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class ExperimentReportCreate(BaseModel):
    title: Optional[str] = None
    simulation_job_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ExperimentReportOut(BaseModel):
    report_id: str
    project_id: str
    tenant_id: str
    title: str
    format: str
    manifest: Dict[str, Any]
    download_path: str
    created_by: str
    created_at: datetime


class SimulationJobOut(BaseModel):
    job_id: str
    project_id: str
    circuit_id: str
    workload_id: Optional[str]
    execution_target_id: Optional[str]
    status: str
    shots: int
    seed: Optional[int]
    result: Optional[Dict[str, Any]] = None
    manifest: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
