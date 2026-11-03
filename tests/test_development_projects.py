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


def test_studio_summary_kpis(client):
    r = client.get(f"{P}/studio/summary", headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert "project_count" in body
    assert "quota" in body
    pa = body["pending_approvals"]
    assert pa is None or isinstance(pa, int)
    assert isinstance(body.get("recent_activity"), list)
    assert "headroom_pct" in body["quota"]


def test_studio_quota_evaluate(client):
    r = client.get(f"{P}/studio/quota-evaluate?shots=512", headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["requested_shots"] == 512
    assert "allowed" in body
    assert "warnings" in body


def test_studio_config_exposes_full_feature_catalog(client):
    r = client.get(f"{P}/studio/config", headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["schema_version"] == 1
    assert len(body["features"]) >= 15
    assert body["settings_schema"]["additionalProperties"] is True


def test_project_crud_and_open_settings(client):
    create = client.post(
        f"{P}/projects",
        headers=HEADERS,
        json={
            "name": "Bell test",
            "template_id": "blank_circuit",
            "settings": {"editor": {"theme": "light", "font_size": 16}},
            "capabilities": {"ai_assist": True},
            "metadata": {"lab": "site-a"},
        },
    )
    assert create.status_code == 201
    proj = create.json()
    assert proj["settings"]["editor"]["theme"] == "light"
    assert proj["capabilities"].get("ai_assist") is True
    pid = proj["project_id"]

    schema = client.get(f"{P}/projects/{pid}/settings-schema", headers=HEADERS)
    assert schema.status_code == 200
    assert "platform_features" in schema.json()

    patch = client.patch(
        f"{P}/projects/{pid}",
        headers=HEADERS,
        json={"settings": {"simulation": {"default_shots": 2048}}},
    )
    assert patch.status_code == 200
    assert patch.json()["settings"]["simulation"]["default_shots"] == 2048

    members = client.get(f"{P}/projects/{pid}/members", headers=HEADERS)
    assert members.status_code == 200
    assert len(members.json()) >= 1
    add = client.post(
        f"{P}/projects/{pid}/members",
        headers=HEADERS,
        json={"username": "collab.user", "role": "viewer"},
    )
    assert add.status_code == 201
    dup = client.post(
        f"{P}/projects/{pid}/members",
        headers=HEADERS,
        json={"username": "collab.user", "role": "viewer"},
    )
    assert dup.status_code == 409

    rem = client.delete(f"{P}/projects/{pid}/members/collab.user", headers=HEADERS)
    assert rem.status_code == 200
    after = client.get(f"{P}/projects/{pid}/members", headers=HEADERS).json()
    assert not any(m["username"] == "collab.user" for m in after)

    owner_user = next(m["username"] for m in after if m["role"] == "owner")
    bad = client.delete(f"{P}/projects/{pid}/members/{owner_user}", headers=HEADERS)
    assert bad.status_code == 409


def test_simulation_creates_workload_job(client):
    create = client.post(
        f"{P}/projects",
        headers=HEADERS,
        json={"name": "Sim proj", "template_id": "blank_circuit"},
    )
    pid = create.json()["project_id"]
    sim = client.post(
        f"{P}/simulation-jobs/project/{pid}/simulate",
        headers=HEADERS,
        json={"shots": 128},
    )
    assert sim.status_code == 201
    job = sim.json()
    assert job["workload_id"]
    assert job["status"] in ("completed", "failed")
    assert job.get("manifest") is not None or job.get("error_message")


def test_dev_rbac_blocks_anonymous_when_enforced(client, monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    r = client.get(f"{P}/projects")
    assert r.status_code == 403
