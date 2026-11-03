"""S11.5 pilot smoke — API paths the Govern SPA depends on (no browser)."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
H = {"X-User-Role": "Researcher"}
ADMIN = {"X-User-Role": "Admin"}


def test_govern_pilot_api_smoke():
    with TestClient(app) as client:
        boundary = client.get(f"{P}/governance/institution-boundary", headers=ADMIN)
        assert boundary.status_code == 200
        assert boundary.json()["cross_tenant_governance_reads"] is False

        me = client.get(
            f"{P}/auth/me",
            headers={"X-User-Role": "Admin", "X-User-Name": "Admin", "X-QRE-Dev-Ack": "1"},
        )
        assert me.status_code == 200
        perms = me.json().get("permissions") or []
        assert "approvals:read" in perms

        summary = client.get(f"{P}/governance/summary", headers=ADMIN)
        assert summary.status_code == 200
        assert "quota" in summary.json()

        pid = client.post(f"{P}/projects", headers=H, json={"name": "PilotSmoke", "template_id": "blank_circuit"}).json()[
            "project_id"
        ]
        cid = client.get(f"{P}/circuits/project/{pid}", headers=H).json()[0]["circuit_id"]
        client.post(f"{P}/circuits/{cid}/simulate", headers=H, json={"shots": 64})
        sub = client.post(
            f"{P}/workload-submissions",
            headers=H,
            json={"project_id": pid, "circuit_id": cid},
        ).json()
        wid = sub["workload_id"]
        client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=H)

        queue = client.get(f"{P}/approvals", headers=ADMIN)
        assert queue.status_code == 200
        assert any(item["workload_id"] == wid for item in queue.json().get("items", []))

        detail = client.get(f"{P}/approvals/{wid}", headers=ADMIN)
        assert detail.status_code == 200
        assert detail.json()["governance_state"] == "submitted_for_review"

        scoped = client.get(f"{P}/governance/summary?project_id={pid}", headers=ADMIN)
        assert scoped.json()["project_id"] == pid
        assert scoped.json()["queue"] >= 1

        mine = client.get(f"{P}/approvals?scope=mine", headers=H)
        assert mine.status_code == 200

        activity = client.get(f"{P}/governance/activity?project_id={pid}", headers=ADMIN)
        assert activity.status_code == 200

        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "s1"})
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "s2"})
        assert client.get(f"{P}/approvals/{wid}", headers=ADMIN).json()["governance_state"] == "approved"
