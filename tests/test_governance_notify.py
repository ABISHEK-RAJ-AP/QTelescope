import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.governance_notify import _post_webhook, _webhook_url_allowed, emit_governance_notify


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_webhook_invalid_url():
    out = _post_webhook("", {"event": "x"}, {})
    assert out["ok"] is False


def test_webhook_ssrf_blocks_public_host():
    cfg = {"webhook_allowed_hosts": [], "webhook_allowed_host_suffixes": []}
    assert _webhook_url_allowed("http://127.0.0.1:9/x", cfg) is True
    assert _webhook_url_allowed("https://evil.example/hook", cfg) is False
    out = _post_webhook("https://evil.example/hook", {"event": "x"}, cfg)
    assert out["ok"] is False
    assert "allowlist" in out["error"]


def test_email_stub_when_enabled(monkeypatch):
    monkeypatch.setattr(
        "app.services.governance_notify._load_config",
        lambda: {
            "events": ["submission.entered_review"],
            "channels": {"email": {"enabled": True, "from": "a@b", "default_to": "c@d"}},
        },
    )
    out = emit_governance_notify("submission.entered_review", {"workload_id": "w1"})
    assert out["queued"] is True
    assert out["delivery"]["email"]["ok"] is True
    assert out["delivery"]["email"]["stub"] is True


def test_emit_subscribed_event_queues_stub():
    out = emit_governance_notify(
        "submission.entered_review",
        {"workload_id": "wl-test", "submission_id": "sub-test"},
    )
    assert out["queued"] is True
    assert out.get("stub") is True


def test_unknown_event_not_queued():
    out = emit_governance_notify("not.a.real.event", {})
    assert out["queued"] is False


def test_notifications_config_api(client):
    from app.core.config import settings

    P = settings.API_V1_STR
    r = client.get(f"{P}/governance/notifications/config", headers={"X-User-Role": "Admin"})
    assert r.status_code == 200
    body = r.json()
    assert "events" in body
    assert "channels" in body
