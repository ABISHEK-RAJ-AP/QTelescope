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


def test_config_status_bootstrap_flags(monkeypatch):
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "true")
    client = _client(monkeypatch)
    body = client.get("/api/v1/auth/config-status").json()
    assert body["bootstrap"]["show_dev_login_presets"] is False
