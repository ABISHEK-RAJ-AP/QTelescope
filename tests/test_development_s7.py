import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
HEADERS = {"X-User-Role": "Researcher"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _project_circuit(client):
    r = client.post(f"{P}/projects", headers=HEADERS, json={"name": "S7", "template_id": "blank_circuit"})
    pid = r.json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=HEADERS).json()[0]["circuit_id"]
    return pid, cid


def test_circuit_simulate_path_and_timeline(client):
    pid, cid = _project_circuit(client)
    sim = client.post(f"{P}/circuits/{cid}/simulate", headers=HEADERS, json={"shots": 64})
    assert sim.status_code == 201
    job = sim.json()
    assert job["status"] in ("completed", "failed", "queued", "running")
    wid = job["workload_id"]
    tl = client.get(f"{P}/workloads/{wid}/timeline", headers=HEADERS)
    assert tl.status_code == 200
    types = [e["event_type"] for e in tl.json()["events"]]
    assert "simulation.queued" in types or "simulation.started" in types

    manifest = client.get(f"{P}/simulation-jobs/{job['job_id']}/manifest", headers=HEADERS)
    assert manifest.status_code == 200
    assert manifest.json()["manifest"].get("execution_class") == "simulated"


def test_experiment_report_html(client):
    pid, cid = _project_circuit(client)
    sim = client.post(f"{P}/circuits/{cid}/simulate", headers=HEADERS, json={"shots": 32})
    job_id = sim.json()["job_id"]
    rep = client.post(
        f"{P}/projects/{pid}/experiment-reports",
        headers={**HEADERS, "X-User-Role": "Researcher"},
        json={"simulation_job_id": job_id},
    )
    assert rep.status_code == 201
    rid = rep.json()["report_id"]
    dl = client.get(f"{P}/experiment-reports/{rid}/download", headers=HEADERS)
    assert dl.status_code == 200
    assert "execution_class" in dl.text
