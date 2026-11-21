"""Reports batch/export/import and evidence snapshot persistence."""
from __future__ import annotations

import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
import app.models.entities as entities  # noqa: F401
from app.main import app
from app.models.entities import AlertModel, BackendModel, ProviderModel

P = settings.API_V1_STR
OPS = {"X-User-Role": "Operator", "X-User-Name": "op", "X-QRE-Dev-Ack": "1"}


@pytest.fixture(autouse=True)
def _db_tables():
    Base.metadata.create_all(bind=engine)
    yield


def _seed_fleet():
    db = SessionLocal()
    try:
        if not db.query(ProviderModel).filter(ProviderModel.provider_id == "ibm").first():
            db.add(ProviderModel(provider_id="ibm", provider_name="IBM", provider_type="ibm"))
        if not db.query(BackendModel).filter(BackendModel.backend_id == "ibm_brisbane").first():
            db.add(
                BackendModel(
                    backend_id="ibm_brisbane",
                    provider_id="ibm",
                    backend_name="Brisbane",
                    backend_type="hardware",
                    qubit_count=127,
                    operational_status="ONLINE",
                )
            )
        if not db.query(AlertModel).filter(AlertModel.alert_id == "alt_report_test").first():
            db.add(
                AlertModel(
                    alert_id="alt_report_test",
                    resource_type="QUBIT",
                    resource_id="ibm_brisbane_Q3",
                    alert_type="t1_degradation",
                    severity="WARNING",
                    message="T1 below rolling baseline",
                    status="ACTIVE",
                    detected_at=datetime.datetime.now(datetime.timezone.utc),
                )
            )
        db.commit()
    finally:
        db.close()


def test_reports_batch_and_export_formats(monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "false")
    _seed_fleet()
    client = TestClient(app)

    batch = client.get(f"{P}/reports/batch").json()
    assert set(batch.keys()) >= {"alerts", "backend_monitoring", "calibration"}
    assert batch["alerts"]["count"] >= 1
    assert "backend_id" in batch["alerts"]["fieldnames"]

    csv = client.get(f"{P}/reports/export", params={"report_type": "alerts", "format": "csv"})
    assert csv.status_code == 200
    assert "backend_id" in csv.text
    assert "alt_report_test" in csv.text

    body = client.get(f"{P}/reports/export", params={"report_type": "alerts", "format": "json"}).json()
    assert body["fieldnames"]
    assert body["row_count"] >= 1
    assert body["records"][0]["summary"]

    html = client.get(f"{P}/reports/export", params={"report_type": "alerts", "format": "html"})
    assert html.status_code == 200
    assert "Field definitions" in html.text
    assert "Rule / metric" in html.text


def test_reports_import_environment_persists(tmp_path, monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    monkeypatch.setattr("app.facility.env_store.ENV_PATH", str(tmp_path / "environment_telemetry.json"))
    client = TestClient(app)
    payload = {
        "kind": "environment",
        "records": [
            {
                "backend_id": "ibm_brisbane",
                "channel": "cryo_temp_mK",
                "value": 12.5,
                "unit": "mK",
            }
        ],
    }
    r = client.post(f"{P}/reports/import", json=payload, headers=OPS)
    assert r.status_code == 200, r.text
    exported = client.get(f"{P}/environment/export").json()
    assert len(exported.get("records", [])) >= 1
    assert exported["records"][0]["backend_id"] == "ibm_brisbane"


def test_evidence_snapshot_survives_new_client(tmp_path, monkeypatch):
    monkeypatch.setenv("ENFORCE_RBAC", "true")
    monkeypatch.setattr("app.evidence.snapshot_builder.EVIDENCE_DIR", str(tmp_path / "evidence"))
    _seed_fleet()
    c1 = TestClient(app)
    created = c1.post(
        f"{P}/evidence/snapshots",
        json={"label": "Integration test pack", "include_alerts": True},
        headers=OPS,
    )
    assert created.status_code == 200, created.text
    snap_id = created.json()["snapshot_id"]

    c2 = TestClient(app)
    listed = c2.get(f"{P}/evidence/snapshots", headers=OPS).json()
    assert any(row["snapshot_id"] == snap_id for row in listed)

    dl = c2.get(f"{P}/evidence/snapshots/{snap_id}/download", headers=OPS)
    assert dl.status_code == 200
    assert dl.headers.get("content-type", "").startswith("application/zip")