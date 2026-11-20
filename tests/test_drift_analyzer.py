from datetime import datetime, timedelta, timezone

from app.analytics.drift_analyzer import DriftAnalyzer


def _series(values, start=None, step_minutes=60):
    start = start or datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    out = []
    for i, v in enumerate(values):
        out.append({"timestamp": start + timedelta(minutes=step_minutes * i), "t1": v})
    return out


def test_rate_of_change_one_hour_apart_equals_absolute_change():
    series = _series([10_742_774.0, 10_160_000.0], step_minutes=60)
    analysis = DriftAnalyzer.analyze_drift(series, metric_key="t1")
    last = analysis["points"][-1]
    assert last["abs_change"] == -582774.0
    assert last["rate_of_change"] == -582774.0


def test_rate_of_change_scales_by_sample_interval():
    series = _series([10_742_774.0, 10_160_000.0], step_minutes=1)
    analysis = DriftAnalyzer.analyze_drift(series, metric_key="t1")
    last = analysis["points"][-1]
    assert last["abs_change"] == -582774.0
    assert last["rate_of_change"] == round(-582774.0 * 60.0, 4)
    assert last.get("interval_hours") == round(1 / 60.0, 6)


def test_first_point_rate_is_zero():
    series = _series([10_000_000.0], step_minutes=60)
    analysis = DriftAnalyzer.analyze_drift(series, metric_key="t1")
    assert analysis["points"] == []