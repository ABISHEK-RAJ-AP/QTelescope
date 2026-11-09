"""E2E captcha bypass gate — lab/Playwright only."""
from fastapi.testclient import TestClient

from app.api.auth import E2E_CAPTCHA_BYPASS_CODE, e2e_captcha_bypass_enabled
from app.main import app


def test_e2e_captcha_bypass_disabled_by_default(monkeypatch):
    monkeypatch.delenv("E2E_CAPTCHA_BYPASS", raising=False)
    assert e2e_captcha_bypass_enabled() is False


def test_e2e_captcha_bypass_blocked_in_production(monkeypatch):
    monkeypatch.setenv("E2E_CAPTCHA_BYPASS", "true")
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert e2e_captcha_bypass_enabled() is False


def test_e2e_captcha_bypass_accepts_magic_code_when_enabled(monkeypatch):
    monkeypatch.setenv("E2E_CAPTCHA_BYPASS", "true")
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS", "false")
    client = TestClient(app)
    cap = client.get("/api/v1/auth/captcha")
    assert cap.status_code == 200
    captcha_id = cap.json()["captcha_id"]
    login = client.post(
        "/api/v1/auth/login",
        json={
            "username": "admin",
            "password": "quantum2026",
            "captcha_id": captcha_id,
            "captcha_code": E2E_CAPTCHA_BYPASS_CODE,
        },
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body.get("status") in ("SUCCESS", "MFA_REQUIRED")
