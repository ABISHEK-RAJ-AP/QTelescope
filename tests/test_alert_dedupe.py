import datetime

import pytest

from app.alerts.alert_engine import AlertEngine
from app.core.database import Base, SessionLocal, engine
import app.models.entities  # noqa: F401 — register metadata
from app.models.entities import AlertModel
from app.services.alert_dedupe import dedupe_open_alerts


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_engine_skips_duplicate_when_acknowledged():
    existing = [
        AlertModel(
            alert_id="alt_old",
            resource_type="QUEUE",
            resource_id="ibm_brisbane",
            alert_type="HIGH_QUEUE",
            severity="WARNING",
            message="pending",
            status="ACKNOWLEDGED",
            detected_at=datetime.datetime.utcnow(),
        )
    ]
    created = AlertEngine.evaluate_telemetry(
        backend_id="ibm_brisbane",
        operational=True,
        pending_jobs=80,
        calibration_freshness="Fresh",
        calibration_age_hours=1.0,
        qubits_telemetry=[],
        existing_active_alerts=existing,
    )
    assert not any(a.alert_type == "HIGH_QUEUE" for a in created)


def test_dedupe_open_alerts_keeps_newest(db_session):
    now = datetime.datetime.utcnow()
    db_session.add_all([
        AlertModel(
            alert_id="alt_a",
            resource_type="QUEUE",
            resource_id="ibm_brisbane",
            alert_type="HIGH_QUEUE",
            severity="WARNING",
            message="new",
            status="ACTIVE",
            detected_at=now,
        ),
        AlertModel(
            alert_id="alt_b",
            resource_type="QUEUE",
            resource_id="ibm_brisbane",
            alert_type="HIGH_QUEUE",
            severity="WARNING",
            message="old",
            status="ACTIVE",
            detected_at=now - datetime.timedelta(hours=2),
        ),
    ])
    db_session.commit()
    n = dedupe_open_alerts(db_session)
    db_session.commit()
    assert n == 1
    rows = {a.alert_id: a.status for a in db_session.query(AlertModel).all()}
    assert rows["alt_a"] == "ACTIVE"
    assert rows["alt_b"] == "RESOLVED"
