"""S11 release gate — critical Govern API journey + evidence endpoint."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
ADMIN = {"X-User-Role": "Admin", "X-QRE-Dev-Ack": "1"}
H = {"X-User-Role": "Researcher"}


def test_release_evidence_endpoint():
    with TestClient(app) as client:
        r = client.get(f"{P}/governance/release-evidence", headers=ADMIN)
        assert r.status_code == 200
        body = r.json()
        assert body["product"] == "qrp-govern"
        assert body["automated_checks"]["tenant_isolation_on_approvals"] is True
        assert "QRP_GOVERN_RUNBOOK.md" in body["documentation"]["govern_runbook"]


def test_critical_govern_path_dispatch_meter_audit():
    with TestClient(app) as client:
        pid = client.post(f"{P}/projects", headers=H, json={"name": "S11", "template_id": "blank_circuit"}).json()[
            "project_id"
        ]
        cid = client.get(f"{P}/circuits/project/{pid}", headers=H).json()[0]["circuit_id"]
        sub = client.post(f"{P}/workload-submissions", headers=H, json={"project_id": pid, "circuit_id": cid}).json()
        wid = sub["workload_id"]
        client.post(f"{P}/workload-submissions/{sub['submission_id']}/submit-for-review", headers=H)

        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "1"})
        client.post(f"{P}/approvals/{wid}/decide", headers=ADMIN, json={"decision": "approve", "comment": "2"})

        dispatch = client.post(
            f"{P}/workloads/{wid}/dispatch-attempts",
            headers=ADMIN,
            json={"idempotency_key": "s11-path", "execution_class": "simulated"},
        )
        assert dispatch.status_code == 200

        meter = client.post(
            f"{P}/meter-samples",
            headers=ADMIN,
            json={"dimension": "tenant:default", "metric": "approved_workloads", "unit": "count", "value": 1},
        )
        assert meter.status_code == 200

        summary = client.get(f"{P}/governance/summary", headers=ADMIN)
        assert summary.status_code == 200
        assert "meter_samples_24h" in summary.json()

        export = client.get(f"{P}/governance/activity/export", headers=ADMIN)
        assert export.status_code == 200
        assert wid in export.text
