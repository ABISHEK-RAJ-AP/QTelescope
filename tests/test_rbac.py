import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.rbac import require_admin, require_operator
from app.core.rbac_audit import rbac_audit_report


def _app_client(monkeypatch, enforce: bool) -> TestClient:
    monkeypatch.setenv("ENFORCE_RBAC", "true" if enforce else "false")
    app = FastAPI()

    @app.get("/admin-only")
    def admin_only(_: str = Depends(require_admin)):
        return {"ok": True}

    @app.get("/operator")
    def operator(_: str = Depends(require_operator)):
        return {"ok": True}

    return TestClient(app)


def test_rbac_audit_report_lists_routes():
    report = rbac_audit_report()
    assert "Authorization" in report["header"]
    assert any("credentials" in r["path"] for r in report["routes"])


def test_rbac_open_when_not_enforced(monkeypatch):
    client = _app_client(monkeypatch, False)
    assert client.get("/admin-only").status_code == 200
    assert client.get("/operator").status_code == 200


def test_rbac_blocks_without_header_when_enforced(monkeypatch):
    client = _app_client(monkeypatch, True)
    assert client.get("/admin-only").status_code == 403
    assert client.get("/operator").status_code == 403
    assert client.get("/operator", headers={"X-User-Role": "Researcher"}).status_code == 403
    assert client.get("/operator", headers={"X-User-Role": "Operator"}).status_code == 200
    assert client.get("/admin-only", headers={"X-User-Role": "Admin"}).status_code == 200
