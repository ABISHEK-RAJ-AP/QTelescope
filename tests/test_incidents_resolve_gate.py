"""Incident resolve requires owner or acknowledgment."""
from __future__ import annotations

import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
import app.models.entities  # noqa: F401
from app.main import app
from app.models.entities import IncidentModel

P = settings.API_V1_STR
HEADERS = {"X-User-Role": "Operator", "X-User-Name": "op", "X-QRE-Dev-Ack": "1"}


@pytest.fixture(autouse=True)
def _db_tables():
    Base.metadata.create_all(bind=engine)
    yield


def _seed_incident(*, incident_id: str, owner: str | None = None, acknowledged_by: str | None = None):
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        db.add(
            IncidentModel(
                incident_id=incident_id,
                title="ibm_brisbane · Low T2",
                backend_id="ibm_brisbane",
                severity="WARNING",
                status="OPEN",
                first_detected_at=now,
                last_detected_at=now,
                owner=owner,
                acknowledged_by=acknowledged_by,
            )
        )
        db.commit()
    finally:
        db.close()


def test_resolve_rejected_without_owner_or_ack(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "false")
    _seed_incident(incident_id="inc_no_owner")
    client = TestClient(app)
    r = client.post(f"{P}/incidents/inc_no_owner/resolve", json={"resolution_notes": "done"}, headers=HEADERS)
    assert r.status_code == 400
    body = r.json()
    msg = (body.get("detail") or body.get("error", {}).get("message") or "").lower()
    assert "owner" in msg or "acknowledge" in msg


def test_resolve_ok_after_ack(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "false")
    _seed_incident(incident_id="inc_ack", acknowledged_by="alice")
    client = TestClient(app)
    r = client.post(f"{P}/incidents/inc_ack/resolve", json={"resolution_notes": "fixed"}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["status"] == "RESOLVED"


def test_assign_sets_owner(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "false")
    _seed_incident(incident_id="inc_assign")
    client = TestClient(app)
    r = client.post(f"{P}/incidents/inc_assign/assign", json={"owner": "bob"}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["owner"] == "bob"