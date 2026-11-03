import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.sessions import create_session
from app.federated.signing import (
    sign_snapshot_payload,
    verify_import_body,
    signing_required,
)
from app.main import app

client = TestClient(app)


def test_sign_and_verify_roundtrip(monkeypatch):
    monkeypatch.setenv("FEDERATION_SIGNING_KEY", "test-secret-key")
    monkeypatch.setenv("FEDERATION_REQUIRE_SIGNATURE", "true")
    payload = {
        "site_id": "lab-a",
        "fleet": {"total": 1, "online": 1, "offline": 0, "maintenance_or_other": 0},
    }
    env = sign_snapshot_payload(payload)
    assert env["signature"]
    ok, msg = verify_import_body(env)
    assert ok, msg


def test_reject_unsigned_when_required(monkeypatch):
    monkeypatch.setenv("FEDERATION_REQUIRE_SIGNATURE", "true")
    monkeypatch.setenv("FEDERATION_SIGNING_KEY", "k")
    ok, msg = verify_import_body({"site_id": "x", "fleet": {"total": 0, "online": 0, "offline": 0, "maintenance_or_other": 0}})
    assert not ok


def test_import_signed_endpoint(monkeypatch):
    monkeypatch.setenv("FEDERATION_SIGNING_KEY", "admin-test-key")
    monkeypatch.setenv("FEDERATION_REQUIRE_SIGNATURE", "false")
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    token = create_session("admin", "Admin")
    p = settings.API_V1_STR
    inner = {
        "site_id": "test-peer-sign",
        "site_name": "Test",
        "fleet": {"total": 1, "online": 1, "offline": 0, "maintenance_or_other": 0},
        "telemetry_source": "imported_snapshot",
    }
    env = sign_snapshot_payload(inner)
    r = client.post(
        f"{p}/federated/snapshots/import-signed",
        json=env,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text


def test_federation_identity():
    r = client.get(f"{settings.API_V1_STR}/federated/identity")
    assert r.status_code == 200
    assert r.json().get("site_id")
