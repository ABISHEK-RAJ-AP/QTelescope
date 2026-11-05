import logging

from fastapi.testclient import TestClient

from app.main import _log_prod_security_warnings, app


def test_prod_profile_logs_rbac_warning(caplog, monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    monkeypatch.setenv("ENFORCE_RBAC", "false")
    caplog.set_level(logging.WARNING, logger="app.startup")
    _log_prod_security_warnings()
    assert any("ENFORCE_RBAC" in r.message for r in caplog.records)


def test_app_still_serves_root_with_prod_profile(monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    with TestClient(app) as client:
        r = client.get("/")
        assert r.status_code == 200
