import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
ADMIN = {"X-User-Role": "Admin"}
RESEARCHER = {"X-User-Role": "Researcher"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _pending_submission(client):
    h = {"X-User-Role": "Researcher"}
    pid = client.post(f"{P}/projects", headers=h, json={"name": "Gov", "template_id": "blank_circuit"}).json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=h).json()[0]["circuit_id"]
    sub = client.post(f"{P}/workload-submissions", headers=h, json={"project_id": pid, "circuit_id": cid}).json()
    client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=h)
    return sub["workload_id"]


def test_institution_boundary(client):
    r = client.get(f"{P}/governance/institution-boundary", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body["governance_data_scope"] == "tenant_isolated"
    assert body["cross_tenant_governance_reads"] is False
    assert "federation" in body
    assert body["federation"]["read_only"] is True


def test_governance_activity_export_csv(client, monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    wid = _pending_submission(client)
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    denied = client.get(f"{P}/governance/activity/export", headers=RESEARCHER)
    assert denied.status_code == 403
    export = client.get(f"{P}/governance/activity/export", headers=ADMIN)
    assert export.status_code == 200
    assert "text/csv" in export.headers.get("content-type", "")
    assert "approval.approve" in export.text
    assert wid in export.text


def test_tenant_isolation_submission(client):
    wid = _pending_submission(client)
    other = client.get(f"{P}/approvals/{wid}", headers={**ADMIN, "X-Tenant-Id": "other-org"})
    assert other.status_code == 404
