from app.api.queue_util import resolve_estimated_wait


def test_wait_unknown_when_pending_without_eta():
    assert resolve_estimated_wait(2, 0) is None
    assert resolve_estimated_wait(2, None) is None


def test_wait_zero_when_idle():
    assert resolve_estimated_wait(0, 0) == 0.0
    assert resolve_estimated_wait(0, None) is None


def test_wait_positive_when_reported():
    assert resolve_estimated_wait(3, 45.5) == 45.5


def test_wait_unknown_when_depth_not_reported():
    assert resolve_estimated_wait(None, None) is None
    assert resolve_estimated_wait(None, 12.0) == 12.0