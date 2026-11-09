"""Bootstrap credential policy — block known default passwords in production."""
from __future__ import annotations

import os

KNOWN_DEFAULT_PASSWORD = "quantum2026"


def block_default_bootstrap_enabled() -> bool:
    """On by default in production profile; override via BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS."""
    from app.core.env_profile import env_flag_prod_default_true

    return env_flag_prod_default_true("BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS")


def is_reserved_bootstrap_user(username: str, admin_username: str, user_username: str) -> bool:
    u = (username or "").strip()
    return u in (admin_username, user_username)


def reject_if_default_bootstrap_password(username: str, password: str, admin_username: str, user_username: str) -> None:
    from fastapi import HTTPException

    if not block_default_bootstrap_enabled():
        return
    if not is_reserved_bootstrap_user(username, admin_username, user_username):
        return
    if password == KNOWN_DEFAULT_PASSWORD:
        raise HTTPException(
            status_code=403,
            detail=(
                "Default bootstrap password is disabled. Set ADMIN_PASSWORD and USER_PASSWORD "
                "in the environment before using reserved accounts."
            ),
        )


def bootstrap_security_report(admin_username: str, user_username: str) -> dict:
    blocked = block_default_bootstrap_enabled()
    return {
        "block_default_bootstrap_credentials": blocked,
        "show_dev_login_presets": not blocked,
        "reserved_usernames": [admin_username, user_username],
        "hint": (
            "Set BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true and configure ADMIN_PASSWORD / USER_PASSWORD for production."
            if not blocked
            else "Dev login presets are hidden; use configured bootstrap passwords."
        ),
    }
