import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import auth as auth_mod
from app.api.auth import router as auth_router
from app.core.config import settings


def _client(monkeypatch):
    monkeypatch.setattr(auth_mod, "_consume_captcha", lambda _a, _b: None)
    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    return TestClient(app)


def test_block_default_bootstrap_password(monkeypatch):
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "true")
    client = _client(monkeypatch)
    resp = client.post(
        "/api/v1/auth/login",
        json={
            "username": settings.ADMIN_USERNAME,
            "password": "quantum2026",
            "captcha_id": "x",
            "captcha_code": "y",
        },
    )
    assert resp.status_code == 403


def test_prod_profile_blocks_default_bootstrap_without_explicit_env(monkeypatch):
    monkeypatch.delenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", raising=False)
    monkeypatch.setenv("QRE_PROFILE", "production")
    from app.core.bootstrap_security import block_default_bootstrap_enabled

    assert block_default_bootstrap_enabled() is True


def test_config_status_bootstrap_flags(monkeypatch):
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "true")
    client = _client(monkeypatch)
    body = client.get("/api/v1/auth/config-status").json()
    assert body["bootstrap"]["show_dev_login_presets"] is False


def test_superadmin_bootstrap_login(monkeypatch):
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "false")
    client = _client(monkeypatch)
    resp = client.post(
        "/api/v1/auth/login",
        json={
            "username": settings.SUPERADMIN_USERNAME,
            "password": settings.SUPERADMIN_PASSWORD,
            "captcha_id": "x",
            "captcha_code": "y",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("status") == "SUCCESS"
    assert body.get("user", {}).get("role") == "SuperAdmin"


def test_config_status_reserved_includes_superadmin(monkeypatch):
    client = _client(monkeypatch)
    reserved = client.get("/api/v1/auth/config-status").json()["bootstrap"]["reserved_usernames"]
    assert settings.SUPERADMIN_USERNAME in reserved


def test_login_without_captcha_is_400(monkeypatch):
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "false")
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    raw = TestClient(app)
    resp = raw.post(
        "/api/v1/auth/login",
        json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD},
    )
    assert resp.status_code == 400
