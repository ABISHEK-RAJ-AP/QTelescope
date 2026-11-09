"""Admin observability APIs (Sprint 4) — RBAC + shape."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
ADMIN = {"X-User-Role": "Admin", "X-User-Name": "admin"}
OPS = {"X-User-Role": "Operator", "X-User-Name": "op"}


def test_observability_admin_routes_require_admin(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    client = TestClient(app)
    for path in (
        f"{P}/admin/collector-executions",
        f"{P}/admin/ingestion-quality",
        f"{P}/admin/audit-log",
    ):
        assert client.get(path).status_code == 403
        assert client.get(path, headers=OPS).status_code == 403
        r = client.get(path, headers=ADMIN)
        assert r.status_code == 200, path
        body = r.json()
        assert "executions" in body or "reports" in body or "events" in body
