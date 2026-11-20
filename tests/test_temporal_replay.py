from datetime import datetime, timezone

from types import SimpleNamespace

from app.analytics.temporal_replay import coherence_panel_at, get_frame


def test_coherence_uses_latest_properties_batch():
    t_props = datetime(2025, 1, 1, 9, 25, tzinfo=timezone.utc)
    t_frame = datetime(2025, 1, 1, 9, 37, tzinfo=timezone.utc)
    rows = [
        SimpleNamespace(timestamp=t_props, t1=100.0, t2=90.0),
        SimpleNamespace(timestamp=t_props, t1=300.0, t2=70.0),
    ]
    panel = coherence_panel_at(t_frame, rows)
    assert panel["qubit_samples"] == 2
    assert panel["t1_mean_us"] == 200.0
    assert panel["coherence_as_of"] == t_props.isoformat()


def test_get_frame_bounds():
    tl = {"frames": [{"index": 0, "at": "t0", "panels": {}}]}
    assert get_frame(tl, 0)["index"] == 0
    assert get_frame(tl, 1) is None
