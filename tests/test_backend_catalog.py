"""Fleet catalogue metadata on GET /backends + admin patch."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.backend_catalog import get_catalog_entry, upsert_catalog

P = settings.API_V1_STR
ADMIN = {"X-User-Role": "Admin", "X-User-Name": "admin"}


def test_catalog_service_defaults_and_upsert(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.backend_catalog._PATH", str(tmp_path / "catalog.json"))
    meta = get_catalog_entry("ibm_brisbane", provider_id="ibm_quantum")
    assert meta["facility"] == "IBM Quantum"
    upsert_catalog("ibm_brisbane", owner="ops", facility="Lab-A", tags=["prod"])
    meta = get_catalog_entry("ibm_brisbane", provider_id="ibm_quantum")
    assert meta["owner"] == "ops"
    assert meta["facility"] == "Lab-A"
    assert meta["tags"] == ["prod"]


def test_backends_include_catalog_fields(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.backend_catalog._PATH", str(tmp_path / "catalog.json"))
    with TestClient(app) as client:
        r = client.get(f"{P}/backends")
        assert r.status_code == 200
        rows = r.json()
        if not rows:
            return
        first = rows[0]
        assert "facility" in first
        assert "owner" in first
        assert "tags" in first


def test_patch_catalog_persists(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.backend_catalog._PATH", str(tmp_path / "catalog.json"))
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    with TestClient(app) as client:
        listed = client.get(f"{P}/backends", headers=ADMIN)
        assert listed.status_code == 200
        rows = listed.json()
        if not rows:
            return
        bid = rows[0]["backend_id"]
        patch = client.patch(
            f"{P}/admin/backends/{bid}/catalog",
            headers=ADMIN,
            json={"owner": "ops-team", "facility": "Lab-A", "tags": ["production", "ibm"]},
        )
        assert patch.status_code == 200
        body = patch.json()
        assert body["owner"] == "ops-team"
        assert body["facility"] == "Lab-A"
        assert "production" in body["tags"]
        again = client.get(f"{P}/backends", headers=ADMIN)
        row = next(b for b in again.json() if b["backend_id"] == bid)
        assert row["owner"] == "ops-team"
        assert row["facility"] == "Lab-A"
