import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
HEADERS = {"X-User-Role": "Researcher", "X-Tenant-Id": "cdac"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _circuit(client):
    r = client.post(f"{P}/projects", headers=HEADERS, json={"name": "T", "template_id": "blank_circuit"})
    pid = r.json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=HEADERS).json()[0]["circuit_id"]
    return pid, cid


def test_estimation_metrics_use_epistemic_shape(client):
    _, cid = _circuit(client)
    r = client.post(f"{P}/circuits/{cid}/estimate", headers=HEADERS, json={"shots": 512})
    assert r.status_code == 200
    metrics = r.json()["metrics"]
    assert "requested_shots" in metrics
    assert "value_kind" in metrics["requested_shots"]


def test_tenant_isolation_on_projects(client):
    client.post(f"{P}/projects", headers=HEADERS, json={"name": "Tenant A"})
    other = {"X-User-Role": "Researcher", "X-Tenant-Id": "other-org"}
    listed = client.get(f"{P}/projects", headers=other)
    assert listed.status_code == 200
    assert all(p.get("tenant_id") == "other-org" for p in listed.json())


def test_approval_decide_flow(client):
    pid, cid = _circuit(client)
    sub = client.post(
        f"{P}/workload-submissions",
        headers=HEADERS,
        json={"project_id": pid, "circuit_id": cid},
    )
    sid = sub.json()["submission_id"]
    wid = sub.json()["workload_id"]
    client.post(f"{P}/workload-submissions/{sid}/submit-for-review", headers=HEADERS)
    queue = client.get(f"{P}/approvals", headers={**HEADERS, "X-User-Role": "Admin"})
    assert queue.status_code == 200
    assert queue.json()["count"] >= 1
    decide = client.post(
        f"{P}/approvals/{wid}/decide",
        headers={**HEADERS, "X-User-Role": "Admin"},
        json={"decision": "approve", "comment": "ok"},
    )
    assert decide.status_code == 200
    state = decide.json()["governance_state"]
    if state in ("submitted_for_review", "in_review"):
        decide2 = client.post(
            f"{P}/approvals/{wid}/decide",
            headers={**HEADERS, "X-User-Role": "Admin"},
            json={"decision": "approve"},
        )
        state = decide2.json()["governance_state"]
    assert state == "approved"
