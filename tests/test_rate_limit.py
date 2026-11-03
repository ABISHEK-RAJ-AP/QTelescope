import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import auth as auth_mod
from app.api.auth import router as auth_router
from app.core.config import settings


def test_login_rate_limit(monkeypatch):
    from app.core import rate_limit as rl_mod

    rl_mod.reset_rate_limits()
    monkeypatch.setenv("CACHE_ENABLED", "false")
    monkeypatch.setenv("REDIS_URL", "")
    monkeypatch.setenv("AUTH_RATE_LIMIT", "2")
    monkeypatch.setenv("AUTH_RATE_WINDOW_SEC", "60")
    monkeypatch.setattr(auth_mod, "_consume_captcha", lambda _a, _b: None)
    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    client = TestClient(app)
    payload = {
        "username": "nobody",
        "password": "wrong",
        "captcha_id": "c",
        "captcha_code": "d",
    }
    assert client.post("/api/v1/auth/login", json=payload).status_code == 401
    assert client.post("/api/v1/auth/login", json=payload).status_code == 401
    assert client.post("/api/v1/auth/login", json=payload).status_code == 429
