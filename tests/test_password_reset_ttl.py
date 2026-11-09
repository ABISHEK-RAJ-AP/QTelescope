import time

from app.core import password_reset as pr


def test_reset_token_expires_after_ttl(monkeypatch):
    monkeypatch.setattr(pr, "TTL_SECONDS", 1)
    token = pr.issue_reset_token("ttl_user")
    assert pr.consume_reset_token(token) == "ttl_user"
    time.sleep(1.05)
    assert pr.consume_reset_token(token) is None


def test_reset_token_ttl_default_is_fifteen_minutes():
    assert pr.TTL_SECONDS == 900
