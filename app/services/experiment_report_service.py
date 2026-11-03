from __future__ import annotations

import html
import json
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.development import DevExperimentReportModel, DevProjectModel, SimulationJobModel


def _esc(text: Any) -> str:
    return html.escape(str(text) if text is not None else "")


def generate_experiment_report(
    db: Session,
    *,
    project: DevProjectModel,
    tenant_id: str,
    created_by: str,
    title: Optional[str] = None,
    simulation_job_id: Optional[str] = None,
) -> DevExperimentReportModel:
    sim: Optional[SimulationJobModel] = None
    if simulation_job_id:
        sim = db.query(SimulationJobModel).filter(SimulationJobModel.job_id == simulation_job_id).first()
    if sim is None:
        sim = (
            db.query(SimulationJobModel)
            .filter(SimulationJobModel.project_id == project.project_id)
            .order_by(SimulationJobModel.created_at.desc())
            .first()
        )
    manifest = (sim.manifest_json if sim else {}) or {}
    exec_class = manifest.get("execution_class", "unknown")
    rep_title = title or f"Experiment report — {project.name}"
    counts = (sim.result_json or {}).get("counts") if sim else None
    rows = ""
    if isinstance(counts, dict):
        for bitstring, n in sorted(counts.items(), key=lambda x: -x[1])[:32]:
            rows += f"<tr><td><code>{_esc(bitstring)}</code></td><td>{_esc(n)}</td></tr>"

    body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>{_esc(rep_title)}</title>
<style>
body {{ font-family: system-ui, sans-serif; margin: 2rem; color: #111; }}
.badge {{ display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; background: #e0e7ff; }}
table {{ border-collapse: collapse; margin-top: 1rem; }}
td, th {{ border: 1px solid #ccc; padding: 0.4rem 0.8rem; }}
</style></head><body>
<h1>{_esc(rep_title)}</h1>
<p>Project <strong>{_esc(project.name)}</strong> · tenant <span class="badge">{_esc(tenant_id)}</span></p>
<h2>Execution label</h2>
<p>execution_class: <strong>{_esc(exec_class)}</strong> (never hardware unless governance-approved dispatch)</p>
<h2>Reproducibility manifest</h2>
<pre>{_esc(json.dumps(manifest, indent=2, default=str))}</pre>
<h2>Simulation counts</h2>
<table><thead><tr><th>Outcome</th><th>Counts</th></tr></thead><tbody>{rows or "<tr><td colspan=2>No simulation data</td></tr>"}</tbody></table>
</body></html>"""

    rid = str(uuid.uuid4())
    report = DevExperimentReportModel(
        report_id=rid,
        tenant_id=tenant_id,
        project_id=project.project_id,
        title=rep_title,
        format="html",
        content_html=body,
        manifest_json=manifest,
        created_by=created_by,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
