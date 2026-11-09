"""RBAC must not trust X-User-Role without X-QRE-Dev-Ack when ENFORCE_RBAC=true."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR


def test_spoofed_admin_header_blocked_when_rbac(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    client = TestClient(app)
    spoof = {"X-User-Role": "Admin", "X-User-Name": "attacker"}
    assert client.get(f"{P}/admin/rbac-audit", headers=spoof).status_code == 403


def test_admin_with_dev_ack_allowed_in_lab(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    client = TestClient(app)
    ok = {"X-User-Role": "Admin", "X-User-Name": "admin", "X-QRE-Dev-Ack": "1"}
    assert client.get(f"{P}/admin/rbac-audit", headers=ok).status_code == 200
