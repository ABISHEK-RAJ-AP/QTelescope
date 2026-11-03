from app.analytics.temporal_replay import get_frame


def test_get_frame_bounds():
    tl = {"frames": [{"index": 0, "at": "t0", "panels": {}}]}
    assert get_frame(tl, 0)["index"] == 0
    assert get_frame(tl, 1) is None
