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


def _project_with_circuit(client: TestClient) -> tuple[str, str]:
    r = client.post(
        f"{P}/projects",
        headers=HEADERS,
        json={"name": "Compile test", "template_id": "blank_circuit"},
    )
    assert r.status_code == 201
    pid = r.json()["project_id"]
    circs = client.get(f"{P}/circuits/project/{pid}", headers=HEADERS)
    cid = circs.json()[0]["circuit_id"]
    return pid, cid


def test_compile_returns_diagnostics(client):
    _, cid = _project_with_circuit(client)
    r = client.post(f"{P}/circuits/{cid}/compile", headers=HEADERS, json={"optimization_level": 1})
    assert r.status_code == 201
    body = r.json()
    assert body["run_id"]
    assert isinstance(body["diagnostics"], list)
    assert body["status"] in ("completed", "failed")
    get_r = client.get(f"{P}/compilation-runs/{body['run_id']}", headers=HEADERS)
    assert get_r.status_code == 200


def test_preflight_simulator_never_hardware_class(client):
    _, cid = _project_with_circuit(client)
    r = client.post(
        f"{P}/circuits/{cid}/preflight",
        headers=HEADERS,
        json={"execution_target_id": "simulator_local"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["execution_class"] == "simulated"
    metrics = body["metrics"]
    assert metrics["execution_class"]["value"] == "simulated"
    hw = metrics.get("hardware_dispatch")
    if hw:
        assert hw["value"] is False


def test_workload_submission_submit_for_review(client):
    pid, cid = _project_with_circuit(client)
    comp = client.post(f"{P}/circuits/{cid}/compile", headers=HEADERS, json={})
    run_id = comp.json()["run_id"]
    pre = client.post(
        f"{P}/circuits/{cid}/preflight",
        headers=HEADERS,
        json={"execution_target_id": "simulator_local"},
    )
    report_id = pre.json()["report_id"]
    sub = client.post(
        f"{P}/workload-submissions",
        headers=HEADERS,
        json={
            "project_id": pid,
            "circuit_id": cid,
            "compilation_run_id": run_id,
            "preflight_report_id": report_id,
        },
    )
    assert sub.status_code == 201
    sid = sub.json()["submission_id"]
    assert sub.json()["governance_state"] == "draft"
    assert sub.json()["manifest"]["auto_dispatch"] is False
    review = client.post(f"{P}/workload-submissions/{sid}/submit-for-review", headers=HEADERS)
    assert review.status_code == 200
    assert review.json()["governance_state"] == "submitted_for_review"
