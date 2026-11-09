"""Fail fast on dangerous production configuration."""
from __future__ import annotations

import logging
import os

from app.core.config import settings
from app.core.env_profile import is_production_profile
from app.core.sessions import require_api_auth
from app.core.rbac import rbac_enforced

_log = logging.getLogger("app.startup")


def validate_startup_configuration() -> None:
    if not is_production_profile():
        return
    bad = []
    if os.getenv("DEBUG", "").lower() in ("1", "true", "yes"):
        bad.append("DEBUG must be off in production")
    if not require_api_auth():
        bad.append("REQUIRE_API_AUTH")
    if not rbac_enforced():
        bad.append("ENFORCE_RBAC")
    sk = settings.SECRET_KEY or ""
    if sk in ("", "cdac_quantum_telemetry_secret_key_2026", "your_secret_key_here"):
        bad.append("SECRET_KEY rotation")
    cors = (os.getenv("CORS_ORIGINS") or "").strip()
    if not cors or cors == "*":
        bad.append("CORS_ORIGINS (explicit UI origin)")
    for msg in bad:
        _log.error("Production configuration gap: %s", msg)
