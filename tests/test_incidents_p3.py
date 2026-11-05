from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.incident_comments import add_comment, list_comments


def test_incident_comment_roundtrip(tmp_path, monkeypatch):
    path = tmp_path / "comments.jsonl"
    monkeypatch.setattr(
        "app.services.incident_comments._PATH",
        str(path),
    )
    row = add_comment("inc_test", author="alice", role="Operator", text="checking backend")
    assert row["comment_id"]
    comments = list_comments("inc_test")
    assert len(comments) == 1
    assert comments[0]["text"] == "checking backend"


def test_incident_mutations_require_operator_when_rbac(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    client = TestClient(app)
    p = settings.API_V1_STR
    r = client.post(f"{p}/incidents/fake_id/acknowledge", json={"acknowledged_by": "x"})
    assert r.status_code == 403


def test_evidence_download_blocks_anonymous_when_rbac(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    client = TestClient(app)
    p = settings.API_V1_STR
    r = client.get(f"{p}/evidence/snapshots/does_not_exist/download")
    assert r.status_code in (403, 404)


def test_platform_health_endpoint():
    with TestClient(app) as client:
        r = client.get(f"{settings.API_V1_STR}/operations/platform-health")
    assert r.status_code == 200
    body = r.json()
    assert "database" in body and "sse_stream" in body
    assert "reachable" in body["database"]
