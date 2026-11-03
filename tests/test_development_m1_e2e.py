"""Build M1 exit: project → sim → report → submit → timeline + lock."""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
H = {"X-User-Role": "Researcher"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_m1_end_to_end(client):
    proj = client.post(f"{P}/projects", headers=H, json={"name": "M1 E2E", "template_id": "blank_circuit"})
    assert proj.status_code == 201
    pid = proj.json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=H).json()[0]["circuit_id"]

    sim = client.post(f"{P}/circuits/{cid}/simulate", headers=H, json={"shots": 64})
    assert sim.status_code == 201
    job = sim.json()
    wid = job["workload_id"]
    assert job["manifest"]["execution_class"] == "simulated"

    rep = client.post(f"{P}/projects/{pid}/experiment-reports", headers=H, json={"simulation_job_id": job["job_id"]})
    assert rep.status_code == 201

    comp = client.post(f"{P}/circuits/{cid}/compile", headers=H, json={})
    pre = client.post(f"{P}/circuits/{cid}/preflight", headers=H, json={"execution_target_id": "simulator_local"})
    sub = client.post(
        f"{P}/workload-submissions",
        headers=H,
        json={"project_id": pid, "circuit_id": cid, "compilation_run_id": comp.json()["run_id"], "preflight_report_id": pre.json()["report_id"]},
    )
    sid = sub.json()["submission_id"]
    review = client.post(f"{P}/workload-submissions/{sid}/submit-for-review", headers=H)
    assert review.json()["governance_state"] == "submitted_for_review"

    tl = client.get(f"{P}/workloads/{wid}/timeline", headers=H)
    event_types = [e["event_type"] for e in tl.json()["events"]]
    assert any("simulation" in t for t in event_types)

    locked = client.get(f"{P}/projects/{pid}", headers=H).json()
    assert locked["submission_lock"] and locked["submission_lock"]["locked"] is True

    patch = client.patch(f"{P}/projects/{pid}", headers=H, json={"name": "Should fail"})
    assert patch.status_code == 409


def test_visual_qasm_roundtrip(client):
    body = {
        "num_qubits": 2,
        "columns": [{"gate": "h", "target": 0}, {"gate": "cx", "control": 0, "target": 1}, {"gate": "measure", "target": 0}],
    }
    qasm = client.post(f"{P}/visual-circuit/to-qasm", headers=H, json=body)
    assert qasm.status_code == 200
    assert "h q[0]" in qasm.json()["source_text"]
    back = client.post(f"{P}/visual-circuit/from-qasm", headers=H, json={"source_text": qasm.json()["source_text"]})
    assert len(back.json()["columns"]) >= 2
