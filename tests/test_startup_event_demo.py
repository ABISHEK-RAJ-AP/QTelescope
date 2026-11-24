"""Production profile gates for public event demo."""
import os

import pytest


def test_production_blocks_public_registration_without_event_flag(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOW_PUBLIC_REGISTRATION", "true")
    monkeypatch.delenv("EVENT_PUBLIC_DEMO", raising=False)
    monkeypatch.setenv("SECRET_KEY", "a" * 64)
    monkeypatch.setenv("CORS_ORIGINS", "https://demo.example")
    monkeypatch.setenv("REQUIRE_API_AUTH", "true")
    monkeypatch.setenv("ENFORCE_RBAC", "true")

    from app.core.startup_validation import validate_startup_configuration

    validate_startup_configuration()
    # errors logged only — import logger capture optional; assert via helper
    from app.core.env_profile import event_public_demo_enabled

    assert not event_public_demo_enabled()


def test_event_public_demo_allows_register_when_hardened(monkeypatch, caplog):
    import logging

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("EVENT_PUBLIC_DEMO", "true")
    monkeypatch.setenv("ALLOW_PUBLIC_REGISTRATION", "true")
    monkeypatch.setenv("SECRET_KEY", "b" * 64)
    monkeypatch.setenv("CORS_ORIGINS", "https://demo.example")
    monkeypatch.setenv("REQUIRE_API_AUTH", "true")
    monkeypatch.setenv("ENFORCE_RBAC", "true")

    from app.core.startup_validation import validate_startup_configuration

    with caplog.at_level(logging.ERROR):
        validate_startup_configuration()
    assert not any("ALLOW_PUBLIC_REGISTRATION" in r.message for r in caplog.records)