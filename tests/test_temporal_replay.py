"""Temporal replay returns newest stored frames, not the oldest tail."""
from __future__ import annotations

import datetime

import pytest

from app.analytics.temporal_replay import build_replay_timeline
from app.core.database import Base, SessionLocal, engine
import app.models.entities  # noqa: F401
from app.models.entities import BackendModel, BackendTelemetryModel, ProviderModel


@pytest.fixture(autouse=True)
def _tables():
    Base.metadata.create_all(bind=engine)
    yield


def test_replay_uses_newest_telemetry_frames():
    db = SessionLocal()
    try:
        db.add(ProviderModel(provider_id="ibm", provider_name="IBM", provider_type="ibm"))
        db.add(
            BackendModel(
                backend_id="ibm_test",
                provider_id="ibm",
                backend_name="Test",
                backend_type="hardware",
                qubit_count=2,
                operational_status="ONLINE",
            )
        )
        base = datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc)
        for i in range(5):
            db.add(
                BackendTelemetryModel(
                    backend_id="ibm_test",
                    timestamp=base + datetime.timedelta(hours=i),
                    operational=True,
                    pending_jobs=i,
                    estimated_wait_time=0.0,
                    telemetry_source="test",
                    data_quality="good",
                )
            )
        db.commit()

        timeline = build_replay_timeline(db, "ibm_test", limit=3)
        frames = timeline["frames"]
        assert len(frames) == 3
        assert frames[-1]["panels"]["queue"]["pending_jobs"] == 4
        assert frames[0]["panels"]["queue"]["pending_jobs"] == 2
    finally:
        db.close()