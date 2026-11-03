from app.analytics.anomaly_detector import analyze_metric_series


def _series(vals):
    return [{"timestamp": f"t{i}", "t1": v} for i, v in enumerate(vals)]


def test_insufficient_data():
    out = analyze_metric_series(_series([100.0]), "t1")
    assert out["status"] == "INSUFFICIENT_DATA"


def test_detects_spike():
    base = [100.0] * 12
    base.append(40.0)
    out = analyze_metric_series(_series(base), "t1")
    assert out["status"] in ("ANOMALY", "WARNING", "CHANGE_POINT")
    assert out["flags"]


def test_stable_series():
    out = analyze_metric_series(_series([100.0 + (i * 0.01) for i in range(15)]), "t1")
    assert out["status"] in ("NORMAL", "WARNING", "CHANGE_POINT")
