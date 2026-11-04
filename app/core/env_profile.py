"""Deployment profile helpers — shared by auth, RBAC, headers."""
from __future__ import annotations

import os


def is_production_profile() -> bool:
    profile = (os.getenv("QRE_PROFILE") or os.getenv("ENVIRONMENT") or "").lower().strip()
    return profile in ("prod", "production")


def env_flag(name: str, *, default: bool = False) -> bool:
    """Read boolean env. Empty → default. Explicit true/false always win."""
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    return str(raw).lower().strip() in ("1", "true", "yes", "on")


def env_flag_prod_default_true(name: str) -> bool:
    """Prod profile defaults ON; non-prod defaults OFF unless explicitly set."""
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return is_production_profile()
    return str(raw).lower().strip() in ("1", "true", "yes", "on")
