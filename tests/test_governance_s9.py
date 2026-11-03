import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
ADMIN = {"X-User-Role": "Admin"}


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
    return sub["workload_id"], sub["submission_id"]


def test_policy_dry_run_pending(client):
    wid, _ = _pending_submission(client)
    pol = client.get(f"{P}/approvals/policy", headers=ADMIN).json()
    pid = pol.get("policy_id") or "default"
    sim = client.post(f"{P}/policies/{pid}/dry-run", headers=ADMIN, json={"workload_id": wid})
    assert sim.status_code == 200
    body = sim.json()
    assert body["decision"] == "PENDING"
    assert "APPROVAL_INCOMPLETE" in body["reason_codes"]
    assert body["writes"] is False


def test_two_stage_approval_policy(client):
    pol = client.get(f"{P}/approvals/policy", headers=ADMIN)
    assert pol.status_code == 200
    assert len(pol.json()["stages"]) >= 2

    wid, _ = _pending_submission(client)
    d1 = client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "tech ok"})
    assert d1.status_code == 200
    assert d1.json()["governance_state"] == "in_review"
    assert d1.json()["outcome"]["final"] is False

    d2 = client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve"})
    assert d2.status_code == 200
    assert d2.json()["governance_state"] == "approved"

    hist = client.get(f"{P}/approvals/{wid}/history", headers=ADMIN)
    assert len(hist.json()["records"]) == 2


def test_illegal_decide_when_not_pending(client):
    wid, _ = _pending_submission(client)
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve"})
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve"})
    bad = client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve"})
    assert bad.status_code == 409
    hist = client.get(f"{P}/approvals/{wid}/history", headers=ADMIN)
    assert len(hist.json()["records"]) == 2
    assert hist.json()["records"][0]["policy_id"]


def test_self_approval_denied(client):
    h = {"X-User-Role": "Researcher"}
    wid, _ = _pending_submission(client)
    denied = client.post(f"{P}/approvals/{wid}/decide", headers=h, json={"decision": "approve"})
    assert denied.status_code == 403


def test_changes_require_comment_and_keep_history(client):
    wid, sid = _pending_submission(client)
    empty = client.post(
        f"{P}/approvals/{wid}/decide",
        headers=ADMIN,
        json={"decision": "changes_requested", "comment": "  "},
    )
    assert empty.status_code == 422
    asked = client.post(
        f"{P}/approvals/{wid}/decide",
        headers=ADMIN,
        json={"decision": "changes_requested", "comment": "fix shots"},
    )
    assert asked.status_code == 200
    assert asked.json()["governance_state"] == "changes_requested"
    again = client.post(f"{P}/workload-submissions/{sid}/submit-for-review", headers={"X-User-Role": "Researcher"})
    assert again.status_code == 200
    assert again.json()["governance_state"] == "submitted_for_review"
    hist = client.get(f"{P}/approvals/{wid}/history", headers=ADMIN)
    assert any(r["decision"] == "changes_requested" for r in hist.json()["records"])


def test_withdraw_keeps_history(client):
    wid, _ = _pending_submission(client)
    gone = client.post(f"{P}/approvals/{wid}/withdraw", headers={"X-User-Role": "Researcher"}, json={})
    assert gone.status_code == 200
    assert gone.json()["governance_state"] == "withdrawn"
    hist = client.get(f"{P}/approvals/{wid}/history", headers=ADMIN)
    assert hist.json()["records"][-1]["decision"] == "withdraw"


def test_stage_conflict_409(client):
    wid, _ = _pending_submission(client)
    bad = client.post(
        f"{P}/approvals/{wid}/decide",
        headers=ADMIN,
        json={"decision": "approve", "expected_stage_id": "not-the-stage"},
    )
    assert bad.status_code == 409


def test_approvals_filter_project_id(client):
    h = {"X-User-Role": "Researcher"}
    pid = client.post(f"{P}/projects", headers=h, json={"name": "FilterA", "template_id": "blank_circuit"}).json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=h).json()[0]["circuit_id"]
    sub = client.post(f"{P}/workload-submissions", headers=h, json={"project_id": pid, "circuit_id": cid}).json()
    client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=h)
    wid = sub["workload_id"]

    other_pid = client.post(f"{P}/projects", headers=h, json={"name": "FilterB", "template_id": "blank_circuit"}).json()["project_id"]
    other_cid = client.get(f"{P}/circuits/project/{other_pid}", headers=h).json()[0]["circuit_id"]
    other_sub = client.post(
        f"{P}/workload-submissions", headers=h, json={"project_id": other_pid, "circuit_id": other_cid}
    ).json()
    client.post(f"{P}/workload-submissions/{other_sub['submission_id']}/submit-for-review", headers=h)

    scoped = client.get(f"{P}/approvals?project_id={pid}", headers=ADMIN).json()["items"]
    assert any(i["workload_id"] == wid for i in scoped)
    assert all(i.get("project_id") == pid for i in scoped)


def test_approvals_scope_mine(client):
    wid, _ = _pending_submission(client)
    researcher = {"X-User-Role": "Researcher"}
    mine_r = client.get(f"{P}/approvals?scope=mine", headers=researcher).json()["items"]
    assert any(i["workload_id"] == wid for i in mine_r)
    other = {"X-User-Role": "Researcher", "X-User-Name": "other-researcher"}
    mine_other = client.get(f"{P}/approvals?scope=mine", headers=other).json()["items"]
    assert not any(i["workload_id"] == wid for i in mine_other)
    mine_admin = client.get(f"{P}/approvals?scope=mine", headers=ADMIN).json()["items"]
    assert any(i["workload_id"] == wid for i in mine_admin)


def test_approvals_scope_mine_honors_state(client):
    wid, _ = _pending_submission(client)
    researcher = {"X-User-Role": "Researcher"}
    waiting = client.get(f"{P}/approvals?scope=mine&state=submitted_for_review", headers=researcher).json()["items"]
    assert any(i["workload_id"] == wid for i in waiting)
    approved = client.get(f"{P}/approvals?scope=mine&state=approved", headers=researcher).json()["items"]
    assert not any(i["workload_id"] == wid for i in approved)


def test_governance_activity_from_approvals(client):
    wid, _ = _pending_submission(client)
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    act = client.get(f"{P}/governance/activity", headers=ADMIN)
    assert act.status_code == 200
    items = act.json()["items"]
    assert any(i["target_id"] == wid for i in items)


def test_governance_activity_filter_project_id(client):
    h = {"X-User-Role": "Researcher"}
    pid = client.post(f"{P}/projects", headers=h, json={"name": "ActScope", "template_id": "blank_circuit"}).json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=h).json()[0]["circuit_id"]
    sub = client.post(f"{P}/workload-submissions", headers=h, json={"project_id": pid, "circuit_id": cid}).json()
    client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=h)
    wid = sub["workload_id"]
    client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "ok"})
    scoped = client.get(f"{P}/governance/activity?project_id={pid}", headers=ADMIN).json()["items"]
    assert any(i["target_id"] == wid for i in scoped)
    assert all(i.get("detail", {}).get("project_id") == pid for i in scoped)


def test_summary_scoped_by_project_id(client):
    h = {"X-User-Role": "Researcher"}
    pid = client.post(f"{P}/projects", headers=h, json={"name": "SumScope", "template_id": "blank_circuit"}).json()["project_id"]
    cid = client.get(f"{P}/circuits/project/{pid}", headers=h).json()[0]["circuit_id"]
    sub = client.post(f"{P}/workload-submissions", headers=h, json={"project_id": pid, "circuit_id": cid}).json()
    client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=h)

    scoped = client.get(f"{P}/governance/summary?project_id={pid}", headers=ADMIN).json()
    assert scoped["project_id"] == pid
    assert scoped["queue"] >= 1
    assert scoped["counts"]["submitted_for_review"] >= 1


def test_governance_summary_seeds_provider_catalogue(client):
    summary = client.get(f"{P}/governance/summary", headers=ADMIN)
    assert summary.status_code == 200
    assert summary.json()["providers_total"] >= 1
    connectors = client.get(f"{P}/connectors", headers=ADMIN)
    assert connectors.status_code == 200
    assert len(connectors.json()["items"]) >= 1


def test_auth_me_dev_ack_returns_permissions(client):
    r = client.get(
        f"{P}/auth/me",
        headers={"X-User-Role": "Admin", "X-User-Name": "Admin", "X-QRE-Dev-Ack": "1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("dev_session") is True
    assert "approvals:read" in body.get("permissions", [])
    bare = client.get(f"{P}/auth/me", headers={"X-User-Role": "Admin"})
    assert bare.json().get("authenticated") is False
    assert "dev_session" not in bare.json()


def test_summary_counts_link_to_real_rows(client):
    wid, _ = _pending_submission(client)
    summary = client.get(f"{P}/governance/summary", headers=ADMIN)
    assert summary.status_code == 200
    body = summary.json()
    assert body["counts"]["submitted_for_review"] >= 1
    assert body["queue"] >= 1
    assert body["source"] == "workload_submissions"
    assert "quota" in body
    assert "daily_shots_cap" in body["quota"]
    assert "providers_total" in body
    assert "inventory_assets" in body
    other = client.get(f"{P}/approvals/{wid}", headers={**ADMIN, "X-Tenant-Id": "other-org"})
    assert other.status_code == 404


def test_meter_sample_unknown_unit_unavailable(client):
    bad = client.post(
        f"{P}/meter-samples",
        headers=ADMIN,
        json={"dimension": "provider:p1", "metric": "latency", "unit": "furlongs", "value": 12},
    )
    assert bad.status_code == 200
    assert bad.json()["availability"] == "unavailable"
    assert bad.json()["value"] is None

    ok = client.post(
        f"{P}/meter-samples",
        headers=ADMIN,
        json={"dimension": "backend:be1", "metric": "queue_depth", "unit": "jobs", "value": 4},
    )
    assert ok.status_code == 200
    assert ok.json()["availability"] == "available"
    rollups = client.get(f"{P}/meter-rollups?hours=24", headers=ADMIN)
    assert rollups.status_code == 200
    assert rollups.json()["sample_count"] >= 2
    rows = [r for r in rollups.json()["items"] if r["metric"] == "queue_depth"]
    assert rows and rows[0]["sum_value"] == 4

    export = client.get(f"{P}/meter-rollups/export?hours=24", headers=ADMIN)
    assert export.status_code == 200
    assert "queue_depth" in export.text


def test_summary_includes_meter_sample_count(client):
    client.post(
        f"{P}/meter-samples",
        headers=ADMIN,
        json={"dimension": "x", "metric": "m", "unit": "count", "value": 1},
    )
    summary = client.get(f"{P}/governance/summary", headers=ADMIN)
    assert summary.json().get("meter_samples_24h", 0) >= 1


def test_quotas_evaluate_tenant_shots(client):
    r = client.get(f"{P}/quotas/evaluate?shots=100", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body["requested_shots"] == 100
    assert body["shots_inferred"] is False
    assert "allowed" in body
    assert body["daily_shots_cap"] >= 1
