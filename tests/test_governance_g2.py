import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models.development import ProviderManifestModel
from app.models.entities import BackendModel, ProviderModel

P = settings.API_V1_STR
ADMIN = {"X-User-Role": "Admin"}
RESEARCHER = {"X-User-Role": "Researcher"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _submission(client):
    pid = client.post(f"{P}/projects", headers=RESEARCHER, json={"name": "G2", "template_id": "blank_circuit"}).json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=RESEARCHER).json()[0]["circuit_id"]
    sub = client.post(f"{P}/workload-submissions", headers=RESEARCHER, json={"project_id": pid, "circuit_id": cid}).json()
    client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=RESEARCHER)
    return pid, sub["workload_id"]


def test_authorize_blocked_until_approved(client):
    _, wid = _submission(client)
    blocked = client.post(
        f"{P}/workloads/{wid}/authorize-dispatch",
        headers=ADMIN,
        json={"execution_class": "simulated"},
    )
    assert blocked.status_code == 200
    assert blocked.json()["eligible"] is False
    assert "approval_not_approved" in blocked.json()["reasons"]
    assert blocked.json()["governance_state"] == "submitted_for_review"


def test_authorize_simulated_after_approval(client):
    _, wid = _submission(client)
    for _ in range(2):
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    ok = client.post(
        f"{P}/workloads/{wid}/authorize-dispatch",
        headers=ADMIN,
        json={"execution_class": "simulated"},
    )
    assert ok.status_code == 200
    assert ok.json()["eligible"] is True
    assert ok.json()["quota"]["allowed"] is True


def test_duplicate_asset_and_atomic_import(client):
    first = client.post(
        f"{P}/inventory/assets",
        headers=ADMIN,
        json={"provider_id": "p1", "native_asset_id": "qpu-1", "asset_class": "qpu", "execution_class": "hardware"},
    )
    assert first.status_code == 200
    dup = client.post(
        f"{P}/inventory/assets",
        headers=ADMIN,
        json={"provider_id": "p1", "native_asset_id": "qpu-1", "asset_class": "qpu", "execution_class": "hardware"},
    )
    assert dup.status_code == 409
    bad = client.post(
        f"{P}/inventory/imports",
        headers=ADMIN,
        json={"provider_id": "p1", "csv_text": "native_asset_id,asset_class,execution_class\nqpu-2,qpu,hardware\n,qpu,nope\n"},
    )
    assert bad.json()["committed"] is False
    listed = client.get(f"{P}/inventory/assets", headers=ADMIN).json()["items"]
    assert all(item["native_asset_id"] != "qpu-2" for item in listed)
    asset_id = first.json()["asset_id"]
    detail = client.get(f"{P}/inventory/assets/{asset_id}", headers=ADMIN)
    assert detail.status_code == 200
    assert detail.json()["native_asset_id"] == "qpu-1"
    missing = client.get(f"{P}/inventory/assets/does-not-exist", headers=ADMIN)
    assert missing.status_code == 404
    assert detail.json()["lifecycle_state"] == "registered"
    bad = client.post(
        f"{P}/inventory/assets/{asset_id}/lifecycle",
        headers=ADMIN,
        json={"lifecycle_state": "maintenance"},
    )
    assert bad.status_code == 409
    act = client.post(
        f"{P}/inventory/assets/{asset_id}/lifecycle",
        headers=ADMIN,
        json={"lifecycle_state": "active"},
    )
    assert act.status_code == 200
    assert act.json()["lifecycle_state"] == "active"

    compat = client.post(
        f"{P}/inventory/compatibility",
        headers=ADMIN,
        json={"asset_id": asset_id, "execution_class": "hardware", "asset_class": "qpu"},
    )
    assert compat.status_code == 200
    assert compat.json()["eligible"] is True

    pool = client.post(f"{P}/virtual-pools", headers=ADMIN, json={"name": "Lab pool", "description": "S5 test"})
    assert pool.status_code == 200
    pid = pool.json()["pool_id"]
    member = client.post(f"{P}/virtual-pools/{pid}/members", headers=ADMIN, json={"asset_id": asset_id})
    assert member.status_code == 200
    assert member.json()["member_count"] == 1

    filtered = client.get(f"{P}/inventory/assets?execution_class=hardware", headers=ADMIN)
    assert all(i["execution_class"] == "hardware" for i in filtered.json()["items"])


def test_suspended_provider_not_eligible(client):
    db = SessionLocal()
    db.add(ProviderModel(provider_id="prov-g2", provider_name="G2", provider_type="cdac", status="active"))
    db.add(
        BackendModel(
            backend_id="be-g2",
            provider_id="prov-g2",
            backend_name="G2 QPU",
            backend_type="hardware",
            qubit_count=8,
            operational_status="ONLINE",
        )
    )
    db.commit()
    db.close()
    pid, _ = _submission(client)
    client.post(f"{P}/providers/prov-g2/transition", headers=ADMIN, json={"status": "suspended"})
    explained = client.get(f"{P}/device-selection", headers=ADMIN, params={"project_id": pid})
    assert explained.status_code == 200
    target = next(t for t in explained.json()["targets"] if t["target_id"] == "backend:be-g2")
    assert target["eligible"] is False
    assert "provider_suspended" in target["reasons"]
    sim = next(t for t in explained.json()["targets"] if t["target_id"] == "simulator_local")
    assert sim["execution_class"] == "simulated"
    assert sim["eligible"] is True


def test_list_dispatch_attempts(client):
    _, wid = _submission(client)
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve"})
    client.post(
        f"{P}/workloads/{wid}/dispatch-attempts",
        headers=ADMIN,
        json={"idempotency_key": "list-test-1", "execution_class": "simulated"},
    )
    listed = client.get(f"{P}/dispatch-attempts", headers=ADMIN)
    assert listed.status_code == 200
    assert any(a["workload_id"] == wid for a in listed.json()["items"])


def test_dispatch_attempt_idempotent_after_approval(client):
    _, wid = _submission(client)
    for _ in range(2):
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    body = {"idempotency_key": "idem-g2-1", "execution_class": "simulated"}
    first = client.post(f"{P}/workloads/{wid}/dispatch-attempts", headers=ADMIN, json=body)
    assert first.status_code == 200
    assert first.json()["dispatch_state"] == "dispatch_authorized"
    assert first.json()["replay"] is False
    second = client.post(f"{P}/workloads/{wid}/dispatch-attempts", headers=ADMIN, json=body)
    assert second.status_code == 200
    assert second.json()["attempt_id"] == first.json()["attempt_id"]
    assert second.json()["replay"] is True


def test_dispatch_reconcile_confirmed(client):
    _, wid = _submission(client)
    for _ in range(2):
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    created = client.post(
        f"{P}/workloads/{wid}/dispatch-attempts",
        headers=ADMIN,
        json={"idempotency_key": "reconcile-1", "execution_class": "simulated"},
    )
    assert created.status_code == 200
    attempt_id = created.json()["attempt_id"]
    bad = client.post(
        f"{P}/dispatch-attempts/{attempt_id}/reconcile",
        headers=ADMIN,
        json={"outcome": "confirmed"},
    )
    assert bad.status_code == 422
    ok = client.post(
        f"{P}/dispatch-attempts/{attempt_id}/reconcile",
        headers=ADMIN,
        json={"outcome": "confirmed", "external_job_id": "job-sim-001"},
    )
    assert ok.status_code == 200
    assert ok.json()["dispatch_state"] == "dispatch_confirmed"
    assert ok.json()["external_job_id"] == "job-sim-001"
    twice = client.post(
        f"{P}/dispatch-attempts/{attempt_id}/reconcile",
        headers=ADMIN,
        json={"outcome": "failed"},
    )
    assert twice.status_code == 409


def test_dispatch_attempt_blocked_before_approval(client):
    _, wid = _submission(client)
    blocked = client.post(
        f"{P}/workloads/{wid}/dispatch-attempts",
        headers=ADMIN,
        json={"idempotency_key": "idem-g2-2", "execution_class": "simulated"},
    )
    assert blocked.status_code == 409


def test_hardware_authorize_requires_manifest(client):
    db = SessionLocal()
    db.add(ProviderModel(provider_id="prov-m", provider_name="M", provider_type="cdac", status="active"))
    db.add(
        BackendModel(
            backend_id="be-m",
            provider_id="prov-m",
            backend_name="M QPU",
            backend_type="hardware",
            qubit_count=4,
            operational_status="ONLINE",
        )
    )
    db.commit()
    db.close()
    _, wid = _submission(client)
    for _ in range(2):
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    no_manifest = client.post(
        f"{P}/workloads/{wid}/authorize-dispatch",
        headers=ADMIN,
        json={"execution_class": "hardware", "backend_id": "be-m"},
    )
    assert "operation_not_declared" in no_manifest.json()["reasons"]
    client.post(
        f"{P}/providers/prov-m/onboarding",
        headers=ADMIN,
        json={"operations": ["submit"], "execution_classes": ["hardware"]},
    )
    with_manifest = client.post(
        f"{P}/workloads/{wid}/authorize-dispatch",
        headers=ADMIN,
        json={"execution_class": "hardware", "backend_id": "be-m"},
    )
    assert with_manifest.json()["eligible"] is True
    assert with_manifest.json()["quota"]["allowed"] is True


def test_authorize_blocked_when_daily_quota_fails(client, monkeypatch):
    from datetime import datetime, timezone
    from uuid import uuid4

    from app.models.development import SimulationJobModel

    monkeypatch.setattr("app.services.tenant_quota.daily_shots_cap_for_tenant", lambda tenant_id: 10)
    pid = client.post(f"{P}/projects", headers=RESEARCHER, json={"name": "QuotaFail", "template_id": "blank_circuit"}).json()[
        "project_id"
    ]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=RESEARCHER).json()[0]["circuit_id"]
    db = SessionLocal()
    db.add(
        SimulationJobModel(
            job_id=str(uuid4()),
            project_id=pid,
            circuit_id=cid,
            status="completed",
            shots=128,
            created_by="researcher",
            completed_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()
    sub = client.post(
        f"{P}/workload-submissions",
        headers=RESEARCHER,
        json={"project_id": pid, "circuit_id": cid},
    ).json()
    wid = sub["workload_id"]
    client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=RESEARCHER)
    for _ in range(2):
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    blocked = client.post(
        f"{P}/workloads/{wid}/authorize-dispatch",
        headers=ADMIN,
        json={"execution_class": "simulated"},
    )
    assert blocked.status_code == 200
    body = blocked.json()
    assert body["eligible"] is False
    assert "quota_fail" in body["reasons"]
    assert body["quota"]["allowed"] is False
    assert body["quota"]["reason_code"] == "quota_fail"
    attempt = client.post(
        f"{P}/workloads/{wid}/dispatch-attempts",
        headers=ADMIN,
        json={"idempotency_key": "idem-quota-fail", "execution_class": "simulated"},
    )
    assert attempt.status_code == 409
