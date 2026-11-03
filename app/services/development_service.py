from __future__ import annotations

import hashlib
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.development import (
    CircuitVersionModel,
    DevProjectMemberModel,
    DevProjectModel,
    DevProjectRevisionModel,
    RegistryTimelineEventModel,
    SimulationJobModel,
    WorkloadModel,
)
from app.studio.platform_config import default_capabilities_map, get_studio_platform_config


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:80] or "project"


def _hash_content(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def project_to_dict(p: DevProjectModel, submission_lock: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "project_id": p.project_id,
        "tenant_id": p.tenant_id,
        "slug": p.slug,
        "name": p.name,
        "description": p.description,
        "project_type": p.project_type,
        "template_id": p.template_id,
        "owner_username": p.owner_username,
        "settings": p.settings_json or {},
        "capabilities": p.capabilities_json or {},
        "tags": p.tags_json or [],
        "metadata": p.metadata_json or {},
        "is_archived": bool(p.is_archived),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "submission_lock": submission_lock,
    }


def merge_settings(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base or {})
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merge_settings(out[k], v)
        else:
            out[k] = v
    return out


def create_project(
    db: Session,
    *,
    tenant_id: str,
    owner_username: str,
    name: str,
    description: Optional[str],
    project_type: str,
    template_id: Optional[str],
    slug: Optional[str],
    settings: Dict[str, Any],
    capabilities: Dict[str, Any],
    tags: List[str],
    metadata: Dict[str, Any],
) -> Tuple[DevProjectModel, Optional[CircuitVersionModel]]:
    catalog = get_studio_platform_config()
    template = None
    if template_id:
        template = next((t for t in catalog["templates"] if t["template_id"] == template_id), None)

    base_settings = template.get("default_settings", {}) if template else {}
    base_caps = default_capabilities_map()
    if template and template.get("default_capabilities"):
        base_caps.update(template["default_capabilities"])
    base_caps.update(capabilities or {})

    final_settings = merge_settings(base_settings, settings or {})
    proj_type = project_type or (template.get("project_type") if template else "quantum_circuit")

    pid = str(uuid.uuid4())
    final_slug = slug or _slugify(name)
    project = DevProjectModel(
        project_id=pid,
        tenant_id=tenant_id,
        slug=final_slug,
        name=name,
        description=description,
        project_type=proj_type,
        template_id=template_id,
        owner_username=owner_username,
        settings_json=final_settings,
        capabilities_json=base_caps,
        tags_json=tags or [],
        metadata_json=metadata or {},
    )
    db.add(project)
    db.add(
        DevProjectMemberModel(project_id=pid, username=owner_username, role="owner")
    )

    initial_circuit = None
    if template and template.get("initial_source"):
        lang = "openqasm3"
        for st in catalog["source_languages"]:
            if st["id"] in ("openqasm3", "python") and proj_type in ("quantum_circuit", "sdk_python"):
                lang = st["id"] if proj_type == "sdk_python" else "openqasm3"
        initial_circuit = add_circuit_version(
            db,
            project_id=pid,
            name="main",
            source_language=lang,
            source_text=template["initial_source"],
            created_by=owner_username,
            metadata={"from_template": template_id},
        )
    db.commit()
    db.refresh(project)
    return project, initial_circuit


def list_projects(db: Session, tenant_id: str, include_archived: bool = False) -> List[DevProjectModel]:
    q = db.query(DevProjectModel).filter(DevProjectModel.tenant_id == tenant_id)
    if not include_archived:
        q = q.filter(DevProjectModel.is_archived.is_(False))
    return q.order_by(DevProjectModel.updated_at.desc()).all()


def get_project(db: Session, project_id: str, tenant_id: str) -> Optional[DevProjectModel]:
    return (
        db.query(DevProjectModel)
        .filter(DevProjectModel.project_id == project_id, DevProjectModel.tenant_id == tenant_id)
        .first()
    )


def update_project(db: Session, project: DevProjectModel, patch: Dict[str, Any]) -> DevProjectModel:
    if patch.get("name") is not None:
        project.name = patch["name"]
    if patch.get("description") is not None:
        project.description = patch["description"]
    if patch.get("project_type") is not None:
        project.project_type = patch["project_type"]
    if patch.get("settings") is not None:
        project.settings_json = merge_settings(project.settings_json or {}, patch["settings"])
    if patch.get("capabilities") is not None:
        merged = dict(project.capabilities_json or {})
        merged.update(patch["capabilities"])
        project.capabilities_json = merged
    if patch.get("tags") is not None:
        project.tags_json = patch["tags"]
    if patch.get("metadata") is not None:
        merged = dict(project.metadata_json or {})
        merged.update(patch["metadata"])
        project.metadata_json = merged
    if patch.get("is_archived") is not None:
        project.is_archived = patch["is_archived"]
    db.commit()
    db.refresh(project)
    return project


def add_circuit_version(
    db: Session,
    *,
    project_id: str,
    name: str,
    source_language: str,
    source_text: str,
    created_by: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> CircuitVersionModel:
    db.query(CircuitVersionModel).filter(
        CircuitVersionModel.project_id == project_id,
        CircuitVersionModel.is_head.is_(True),
    ).update({"is_head": False})

    max_v = (
        db.query(CircuitVersionModel)
        .filter(CircuitVersionModel.project_id == project_id)
        .count()
    )
    cid = str(uuid.uuid4())
    circ = CircuitVersionModel(
        circuit_id=cid,
        project_id=project_id,
        name=name,
        version_number=max_v + 1,
        source_language=source_language,
        content_hash=_hash_content(source_text or ""),
        source_text=source_text,
        metadata_json=metadata or {},
        is_head=True,
        created_by=created_by,
    )
    db.add(circ)
    db.commit()
    db.refresh(circ)
    return circ


def append_timeline(db: Session, workload_id: str, source_system: str, event_type: str, payload: Dict[str, Any]) -> None:
    db.add(
        RegistryTimelineEventModel(
            event_id=str(uuid.uuid4()),
            workload_id=workload_id,
            source_system=source_system,
            event_type=event_type,
            payload_json=payload,
        )
    )


def enqueue_simulation_job(
    db: Session,
    *,
    project: DevProjectModel,
    circuit: CircuitVersionModel,
    created_by: str,
    shots: int,
    seed: Optional[int],
    execution_target_id: Optional[str],
    parameters: Dict[str, Any],
) -> SimulationJobModel:
    workload_id = str(uuid.uuid4())
    db.add(
        WorkloadModel(
            workload_id=workload_id,
            tenant_id=project.tenant_id,
            project_id=project.project_id,
            state="simulating",
            title=f"Sim: {project.name}",
            created_by=created_by,
        )
    )
    job_id = str(uuid.uuid4())
    job = SimulationJobModel(
        job_id=job_id,
        project_id=project.project_id,
        circuit_id=circuit.circuit_id,
        workload_id=workload_id,
        execution_target_id=execution_target_id or "simulator_local",
        status="queued",
        shots=shots,
        seed=seed,
        parameters_json=parameters or {},
        created_by=created_by,
    )
    db.add(job)
    append_timeline(
        db,
        workload_id,
        "development",
        "simulation.queued",
        {"job_id": job_id, "circuit_id": circuit.circuit_id, "shots": shots},
    )
    db.commit()
    db.refresh(job)
    return job


def process_simulation_job(db: Session, job_id: str) -> Optional[SimulationJobModel]:
    job = db.query(SimulationJobModel).filter(SimulationJobModel.job_id == job_id).first()
    if not job or job.status not in ("queued", "running"):
        return job
    circuit = db.query(CircuitVersionModel).filter(CircuitVersionModel.circuit_id == job.circuit_id).first()
    if not circuit:
        job.status = "failed"
        job.error_message = "Circuit not found"
        from app.models.development import _utcnow

        job.completed_at = _utcnow()
        db.commit()
        return job

    job.status = "running"
    db.commit()
    append_timeline(
        db,
        job.workload_id,
        "development",
        "simulation.started",
        {"job_id": job_id, "circuit_id": job.circuit_id, "shots": job.shots},
    )
    db.commit()

    result, manifest, err = _execute_simulator(
        circuit.source_text or "", circuit.source_language, job.shots, job.seed
    )
    from app.services.reproducibility import completeness_check

    job.manifest_json = manifest
    if manifest:
        manifest["reproducibility"] = completeness_check(manifest)
    if err:
        job.status = "failed"
        job.error_message = err
        if job.workload_id:
            append_timeline(
                db,
                job.workload_id,
                "development",
                "simulation.failed",
                {"job_id": job_id, "error": err[:500]},
            )
    else:
        job.status = "completed"
        job.result_json = result
        append_timeline(
            db,
            job.workload_id,
            "development",
            "simulation.completed",
            {"job_id": job_id, "execution_class": "simulated"},
        )
    from app.models.development import _utcnow

    job.completed_at = _utcnow()
    db.commit()
    db.refresh(job)
    return job


def run_simulation_job(
    db: Session,
    *,
    project: DevProjectModel,
    circuit: CircuitVersionModel,
    created_by: str,
    shots: int,
    seed: Optional[int],
    execution_target_id: Optional[str],
    parameters: Dict[str, Any],
) -> SimulationJobModel:
    from app.workers.simulation_runner import kick_simulation_job, simulation_async_enabled

    job = enqueue_simulation_job(
        db,
        project=project,
        circuit=circuit,
        created_by=created_by,
        shots=shots,
        seed=seed,
        execution_target_id=execution_target_id,
        parameters=parameters,
    )
    if simulation_async_enabled():
        kick_simulation_job(job.job_id)
        db.refresh(job)
        return job
    return process_simulation_job(db, job.job_id) or job


def list_workload_timeline(db: Session, workload_id: str, limit: int = 100) -> List[RegistryTimelineEventModel]:
    return (
        db.query(RegistryTimelineEventModel)
        .filter(RegistryTimelineEventModel.workload_id == workload_id)
        .order_by(RegistryTimelineEventModel.created_at.asc())
        .limit(limit)
        .all()
    )


def _execute_simulator(source: str, language: str, shots: int, seed: Optional[int]) -> Tuple[Optional[Dict], Optional[Dict], Optional[str]]:
    """Run local simulator when Qiskit available; otherwise deterministic stub counts."""
    manifest = {
        "execution_class": "simulated",
        "tool": "qiskit-aer",
        "tool_version": None,
        "missing_fields": [],
    }
    try:
        if language in ("openqasm2", "qiskit", "python", "openqasm3"):
            from qiskit import QuantumCircuit
            from qiskit_aer import AerSimulator
            import qiskit

            manifest["tool_version"] = getattr(qiskit, "__version__", None)
            if language == "python":
                local: Dict[str, Any] = {}
                exec(source, local, local)
                qc = local.get("qc") or local.get("circuit")
                if qc is None:
                    return None, None, "Python source must define `qc` or `circuit` QuantumCircuit"
            elif language == "openqasm3" or "OPENQASM 3" in (source or ""):
                import os
                from app.services.oqasm3_compat import downgrade_oqasm3_to_qasm2

                q2 = downgrade_oqasm3_to_qasm2(source or "")
                transpile_on = os.getenv("QRE_OQASM3_TRANSPILE", "").lower().strip() in ("1", "true", "yes")
                if not q2 or not transpile_on:
                    manifest["tool"] = "builtin-stub"
                    manifest["missing_fields"] = ["openqasm3_sim_deferred"]
                    n = max(2, min(8, (source or "").count("q[") + (source or "").count("qubit") + 1))
                    counts = {"0" * n: shots}
                    if q2:
                        manifest["openqasm3_downgraded"] = True
                    return {"counts": counts, "shots": shots, "stub": True}, manifest, None
                manifest["openqasm3_downgraded"] = True
                qc = QuantumCircuit.from_qasm_str(q2)
            else:
                qc = QuantumCircuit.from_qasm_str(source)
            sim = AerSimulator()
            if seed is not None:
                sim = AerSimulator(seed_simulator=seed)
            job = sim.run(qc, shots=shots)
            counts = job.result().get_counts()
            return {"counts": counts, "shots": shots}, manifest, None
    except ImportError:
        manifest["tool"] = "builtin-stub"
        manifest["missing_fields"] = ["qiskit_not_installed"]
        counts = {"0" * max(1, min(8, len(source) % 4 + 2)): shots}
        return {"counts": counts, "shots": shots, "stub": True}, manifest, None
    except Exception as e:
        return None, manifest, str(e)
    return None, manifest, f"Unsupported source_language: {language}"
