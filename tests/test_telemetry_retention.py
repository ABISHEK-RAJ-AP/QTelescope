from datetime import datetime, timedelta, timezone

from app.core.database import Base, SessionLocal, engine
from app.jobs.telemetry_retention import retention_policy, run_telemetry_retention
from app.models.entities import BackendModel, BackendTelemetryModel, ProviderModel
import app.models.entities  # noqa: F401


def _seed_old_row(db):
    if not db.query(ProviderModel).filter(ProviderModel.provider_id == "p1").first():
        db.add(ProviderModel(provider_id="p1", provider_name="P", provider_type="simulator"))
    if not db.query(BackendModel).filter(BackendModel.backend_id == "b1").first():
        db.add(
            BackendModel(
                backend_id="b1",
                provider_id="p1",
                backend_name="B1",
                backend_type="simulator",
                qubit_count=1,
                operational_status="ONLINE",
            )
        )
    old = datetime.now(timezone.utc) - timedelta(days=120)
    db.add(
        BackendTelemetryModel(
            timestamp=old,
            backend_id="b1",
            operational=True,
            pending_jobs=0,
        )
    )
    db.commit()


def test_retention_deletes_old_telemetry(monkeypatch):
    monkeypatch.setenv("TELEMETRY_RETENTION_DAYS", "90")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_old_row(db)
        before = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == "b1")
            .count()
        )
        assert before >= 1
        run_telemetry_retention(db, days=90)
        after = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == "b1")
            .count()
        )
        assert after == 0
    finally:
        db.close()


def test_retention_policy_bounds():
    p = retention_policy()
    assert 7 <= p["telemetry_retention_days"] <= 3650
