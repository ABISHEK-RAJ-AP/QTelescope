"""VAPT / production defaults — security headers + prod profile flags."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def clear_prod_env(monkeypatch):
    for k in (
        "ENVIRONMENT",
        "QRE_PROFILE",
        "REQUIRE_API_AUTH",
        "ENFORCE_RBAC",
        "BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS",
    ):
        monkeypatch.delenv(k, raising=False)


def test_lab_defaults_off(clear_prod_env, monkeypatch):
    from app.core.bootstrap_security import block_default_bootstrap_enabled
    from app.core.rbac import rbac_enforced
    from app.core.sessions import require_api_auth

    assert require_api_auth() is False
    assert rbac_enforced() is False
    assert block_default_bootstrap_enabled() is False


def test_prod_profile_defaults_on(clear_prod_env, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    from importlib import reload
    import app.core.env_profile as ep
    import app.core.sessions as sessions
    import app.core.rbac as rbac
    import app.core.bootstrap_security as boot

    reload(ep)
    assert sessions.require_api_auth() is True
    assert rbac.rbac_enforced() is True
    assert boot.block_default_bootstrap_enabled() is False
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "true")
    assert boot.block_default_bootstrap_enabled() is True


def test_security_headers_on_root(clear_prod_env):
    from app.main import app

    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert "strict-origin-when-cross-origin" in (res.headers.get("referrer-policy") or "")
