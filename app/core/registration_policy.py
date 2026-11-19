"""Whether self-service /auth/register is allowed."""
from __future__ import annotations

import os

from app.core.env_profile import env_flag, is_production_profile


def public_registration_allowed() -> bool:
    """
    Lab/demo: on by default. Production profile: off unless ALLOW_PUBLIC_REGISTRATION=true.
    Override always wins when env is set explicitly.
    """
    raw = os.getenv("ALLOW_PUBLIC_REGISTRATION")
    if raw is not None and str(raw).strip() != "":
        return env_flag("ALLOW_PUBLIC_REGISTRATION", default=False)
    return not is_production_profile()