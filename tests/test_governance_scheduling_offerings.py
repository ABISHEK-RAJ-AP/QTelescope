"""Governance scheduling config + synthetic offerings (v1)."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

P = "/api/v1"
ADMIN = {"X-User-Role": "Admin", "X-User-Name": "admin", "X-Tenant-Id": "tenant-a"}


@pytest.fixture
def client():
    os.environ.setdefault("USE_ALEMBIC", "false")
    with TestClient(app) as c:
        yield c


def test_scheduling_config_empty(client, tmp_path, monkeypatch):
    from app.services import governance_scheduling as gs

    monkeypatch.setattr(gs, "_STORE", tmp_path / "scheduling.json")
    r = client.get(f"{P}/governance/scheduling-config", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is False
    assert body["tenant_id"] == "tenant-a"
    assert body["weekday_hours"] == {}


def test_scheduling_config_upsert_and_read(client, tmp_path, monkeypatch):
    from app.services import governance_scheduling as gs

    monkeypatch.setattr(gs, "_STORE", tmp_path / "scheduling.json")
    put = client.put(
        f"{P}/governance/scheduling-config",
        headers=ADMIN,
        json={
            "timezone": "Asia/Kolkata",
            "weekday_hours": {"mon": {"open": "09:00", "close": "17:00"}},
            "blackout_dates": ["2026-12-25"],
            "blackout_windows": [
                {"start": "2026-12-31T18:00:00+05:30", "end": "2027-01-01T09:00:00+05:30", "reason": "year-end"}
            ],
        },
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["timezone"] == "Asia/Kolkata"
    assert body["blackout_dates"] == ["2026-12-25"]

    bad = client.put(
        f"{P}/governance/scheduling-config",
        headers=ADMIN,
        json={"timezone": "Not/A/Zone", "weekday_hours": {}},
    )
    assert bad.status_code == 400


def test_scheduling_config_requires_platform_manage(client, tmp_path, monkeypatch):
    from app.services import governance_scheduling as gs

    monkeypatch.setattr(gs, "_STORE", tmp_path / "scheduling.json")
    viewer = {"X-User-Role": "Researcher", "X-User-Name": "r1", "X-Tenant-Id": "tenant-a"}
    r = client.put(
        f"{P}/governance/scheduling-config",
        headers=viewer,
        json={"timezone": "UTC", "weekday_hours": {}},
    )
    if os.environ.get("ENFORCE_RBAC", "false").lower() in ("1", "true", "yes"):
        assert r.status_code == 403
    else:
        assert r.status_code == 200


def test_offerings_list_synthetic(client):
    r = client.get(f"{P}/governance/offerings", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body.get("synthetic") is True
    assert "items" in body
    for row in body["items"]:
        assert row.get("synthetic") is True
        assert row["offering_id"].startswith("synthetic:")


def test_offerings_detail_404(client):
    r = client.get(f"{P}/governance/offerings/synthetic:missing-asset", headers=ADMIN)
    assert r.status_code == 404