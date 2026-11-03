"""Forge → govern API journey (S11.5 precursor — no browser)."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
H = {"X-User-Role": "Researcher"}
ADMIN = {"X-User-Role": "Admin"}


def test_build_submit_govern_approve_unlocks_project():
    with TestClient(app) as client:
        pid = client.post(f"{P}/projects", headers=H, json={"name": "Journey", "template_id": "blank_circuit"}).json()[
            "project_id"
        ]
        cid = client.get(f"{P}/circuits/project/{pid}", headers=H).json()[0]["circuit_id"]
        sim = client.post(f"{P}/circuits/{cid}/simulate", headers=H, json={"shots": 128})
        assert sim.status_code == 201

        comp = client.post(f"{P}/circuits/{cid}/compile", headers=H, json={})
        pre = client.post(
            f"{P}/circuits/{cid}/preflight",
            headers=H,
            json={"execution_target_id": "simulator_local"},
        )
        sub = client.post(
            f"{P}/workload-submissions",
            headers=H,
            json={
                "project_id": pid,
                "circuit_id": cid,
                "compilation_run_id": comp.json()["run_id"],
                "preflight_report_id": pre.json()["report_id"],
            },
        ).json()
        wid = sub["workload_id"]
        client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=H)

        quota = client.get(f"{P}/quotas/evaluate?workload_id={wid}", headers=ADMIN).json()
        assert quota["shots_inferred"] is True
        assert quota["requested_shots"] == 128

        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "stage1"})
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "stage2"})
        detail = client.get(f"{P}/approvals/{wid}", headers=ADMIN).json()
        assert detail["governance_state"] == "approved"

        proj = client.get(f"{P}/projects/{pid}", headers=H).json()
        lock = proj.get("submission_lock") or {}
        assert lock.get("locked") is True
        assert lock.get("governance_state") == "approved"

        activity = client.get(f"{P}/governance/activity?project_id={pid}", headers=ADMIN).json()
        assert len(activity["items"]) >= 2
