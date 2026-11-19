"""Public registration policy."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.registration_policy import public_registration_allowed
from app.main import app


def test_lab_allows_registration_by_default(monkeypatch):
    monkeypatch.delenv("QRE_PROFILE", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ALLOW_PUBLIC_REGISTRATION", raising=False)
    assert public_registration_allowed() is True


def test_production_blocks_registration_by_default(monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    monkeypatch.delenv("ALLOW_PUBLIC_REGISTRATION", raising=False)
    assert public_registration_allowed() is False


def test_production_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    monkeypatch.setenv("ALLOW_PUBLIC_REGISTRATION", "true")
    assert public_registration_allowed() is True


def test_register_endpoint_403_when_disabled(monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    monkeypatch.delenv("ALLOW_PUBLIC_REGISTRATION", raising=False)
    with TestClient(app) as client:
        r = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "password": "secret12",
                "email": "u@example.com",
                "captcha_id": "x",
                "captcha_code": "x",
            },
        )
        assert r.status_code == 403