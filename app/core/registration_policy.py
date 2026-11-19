"""Whether self-service /auth/register is allowed."""
from __future__ import annotations

import os
from typing import List

from app.core.env_profile import env_flag, is_production_profile

_DEFAULT_ORGS = (
    "C-DAC",
    "C-DAC Pune",
    "C-DAC Bengaluru",
    "C-DAC Kolkata",
    "IBM Quantum Network",
    "IonQ Partner Lab",
    "Other — contact administrator",
)


def public_registration_allowed() -> bool:
    """
    Lab/demo: on by default. Production profile: off unless ALLOW_PUBLIC_REGISTRATION=true.
    Override always wins when env is set explicitly.
    """
    raw = os.getenv("ALLOW_PUBLIC_REGISTRATION")
    if raw is not None and str(raw).strip() != "":
        return env_flag("ALLOW_PUBLIC_REGISTRATION", default=False)
    return not is_production_profile()


def registration_requires_admin_approval() -> bool:
    """
    After email OTP, new accounts may await administrator approval before sign-in.
    Production: on by default. Lab/demo: off unless REGISTRATION_REQUIRES_ADMIN_APPROVAL is set.
    """
    raw = os.getenv("REGISTRATION_REQUIRES_ADMIN_APPROVAL")
    if raw is not None and str(raw).strip() != "":
        return env_flag("REGISTRATION_REQUIRES_ADMIN_APPROVAL", default=True)
    return is_production_profile()


def registration_org_options() -> List[str]:
    raw = (os.getenv("REGISTRATION_ORG_OPTIONS") or "").strip()
    if not raw:
        return list(_DEFAULT_ORGS)
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts or list(_DEFAULT_ORGS)