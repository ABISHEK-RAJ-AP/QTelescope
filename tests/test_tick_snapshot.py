"""Live telemetry tick snapshot — staleness helpers."""
from datetime import datetime, timedelta, timezone

from app.api.events import _measurement_staleness


def test_staleness_positive_when_measurement_older():
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    old = now - timedelta(seconds=120)
    age, skew = _measurement_staleness(now, old)
    assert age == 120.0
    assert skew is False


def test_staleness_clamps_future_measurement_clock_skew():
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    future = now + timedelta(hours=3)
    age, skew = _measurement_staleness(now, future)
    assert age == 0.0
    assert skew is True


def test_staleness_naive_timestamp_treated_as_utc():
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    old_naive = datetime(2026, 1, 1, 11, 58, 0)  # no tz — stored as UTC
    age, skew = _measurement_staleness(now, old_naive)
    assert age == 120.0
    assert skew is False