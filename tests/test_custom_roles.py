"""Custom role CRUD on the JSON catalog."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.users import router as users_router
from app.core.config import settings
from app.core import custom_roles
from app.core.permissions import permissions_for_role


def _client(monkeypatch, tmp_path):
    monkeypatch.setattr(custom_roles, "_PATH", str(tmp_path / "custom_roles.json"))
    app = FastAPI()
    app.include_router(users_router, prefix=settings.API_V1_STR)
    return TestClient(app)


def test_create_clone_and_resolve(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)
    headers = {"X-User-Role": "Admin", "X-User-Name": "admin"}
    res = client.post(
        "/api/v1/users/roles",
        headers=headers,
        json={"id": "LabOps", "label": "Lab ops", "clone_from": "Operator", "permissions": ["audit:read"]},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == "LabOps"
    assert "executions:read" in body["permissions"]
    assert "audit:read" in body["permissions"]
    assert "audit:read" in permissions_for_role("LabOps")
    catalog = client.get("/api/v1/users/roles/catalog", headers=headers).json()["roles"]
    assert any(r["id"] == "LabOps" and r["builtin"] is False for r in catalog)
    assert any(r["id"] == "SuperAdmin" and r["builtin"] is True for r in catalog)


def test_cannot_overwrite_builtin(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)
    headers = {"X-User-Role": "Admin", "X-User-Name": "admin"}
    res = client.post(
        "/api/v1/users/roles",
        headers=headers,
        json={"id": "Admin", "label": "Nope", "permissions": ["users:read"]},
    )
    assert res.status_code == 400
