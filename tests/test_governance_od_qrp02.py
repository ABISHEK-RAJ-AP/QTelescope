"""OD-QRP-02 operational surfaces: quota ledger + reservations."""
from __future__ import annotations

import os
from datetime import datetime, timezone

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


def test_quota_ledger(client):
    r = client.get(f"{P}/quotas/ledger", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert "daily_shots_cap" in body
    assert "entries" in body
    assert body.get("ledger_kind") == "simulation_shots_daily"
    assert body.get("window") == "today"
    assert "used_shots_lifetime" in body
    assert "by_project" in body
    assert body.get("dimension") == "simulation_shots"


def test_quota_ledger_window_and_project_filter(client):
    bad = client.get(f"{P}/quotas/ledger?window=year", headers=ADMIN)
    assert bad.status_code == 400
    week = client.get(f"{P}/quotas/ledger?window=7d&limit=10", headers=ADMIN)
    assert week.status_code == 200
    assert week.json()["window"] == "7d"
    scoped = client.get(f"{P}/quotas/ledger?project_id=does-not-exist", headers=ADMIN)
    assert scoped.status_code == 200
    assert scoped.json()["entries"] == []
    assert scoped.json()["used_shots"] == 0


def test_quota_evaluate_daily_window(client):
    r = client.get(f"{P}/quotas/evaluate?shots=100", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body["window"] == "today"
    assert "remaining_shots" in body
    assert "used_shots_lifetime" in body


def test_reservations_crud(client, tmp_path, monkeypatch):
    from app.services import governance_reservations as gr

    monkeypatch.setattr(gr, "_STORE", tmp_path / "reservations.json")
    r = client.post(
        f"{P}/reservations",
        headers=ADMIN,
        json={
            "resource_ref": "asset-demo-1",
            "project_id": "proj-1",
            "window_start": "2026-11-03T09:00:00Z",
            "window_end": "2026-11-03T11:00:00Z",
            "purpose": "Calibration window",
        },
    )
    assert r.status_code == 200
    rid = r.json()["reservation_id"]
    listed = client.get(f"{P}/reservations", headers=ADMIN)
    assert listed.status_code == 200
    assert any(x["reservation_id"] == rid for x in listed.json()["items"])
    tr = client.post(
        f"{P}/reservations/{rid}/transition",
        headers=ADMIN,
        json={"state": "active"},
    )
    assert tr.status_code == 200
    assert tr.json()["state"] == "active"
    illegal = client.post(
        f"{P}/reservations/{rid}/transition",
        headers=ADMIN,
        json={"state": "requested"},
    )
    assert illegal.status_code == 400


def test_reservation_conflict_and_window_validation(client, tmp_path, monkeypatch):
    from app.services import governance_reservations as gr

    monkeypatch.setattr(gr, "_STORE", tmp_path / "reservations.json")
    first = client.post(
        f"{P}/reservations",
        headers=ADMIN,
        json={
            "resource_ref": "qpu-1",
            "window_start": "2026-11-03T09:00:00Z",
            "window_end": "2026-11-03T11:00:00Z",
            "purpose": "First hold",
        },
    )
    assert first.status_code == 200
    overlap = client.post(
        f"{P}/reservations",
        headers=ADMIN,
        json={
            "resource_ref": "qpu-1",
            "window_start": "2026-11-03T10:00:00Z",
            "window_end": "2026-11-03T12:00:00Z",
            "purpose": "Overlapping hold",
        },
    )
    assert overlap.status_code == 200
    assert overlap.json()["has_conflict"] is True
    listed = client.get(f"{P}/reservations?resource_ref=qpu-1", headers=ADMIN)
    assert listed.status_code == 200
    assert listed.json()["conflict_count"] >= 1
    bad_window = client.post(
        f"{P}/reservations",
        headers=ADMIN,
        json={
            "resource_ref": "qpu-1",
            "window_start": "2026-11-03T12:00:00Z",
            "window_end": "2026-11-03T11:00:00Z",
            "purpose": "Backwards",
        },
    )
    assert bad_window.status_code == 400


def test_dispatch_icd(client):
    r = client.get(f"{P}/dispatch-icd", headers=ADMIN)
    assert r.status_code == 200
    assert r.json().get("icd_version")


def test_window_bounds_today():
    from app.services.tenant_quota import window_bounds

    start, end, key = window_bounds("today")
    assert key == "today"
    assert start is not None
    assert end.tzinfo == timezone.utc
    assert start <= datetime.now(timezone.utc)
