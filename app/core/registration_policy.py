"""Whether self-service /auth/register is allowed."""
from __future__ import annotations

import os
from typing import List

from app.core.config import settings
from app.core.env_profile import env_flag, is_production_profile


def registration_screen_otp_exposed() -> bool:
    """Whether register/send-otp may include screen_otp in JSON when not emailing."""
    if env_flag("REGISTRATION_HIDE_SCREEN_OTP", default=False):
        return False
    if settings.ENABLE_MOCK_DATA:
        return True
    raw = os.getenv("REGISTRATION_OTP_DELIVERY") or ""
    if str(raw).strip().lower() == "screen":
        return True
    # Default on: without SMTP the UI cannot work unless the code is returned.
    return env_flag("REGISTRATION_SCREEN_OTP", default=True)

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
    Off by default; set REGISTRATION_REQUIRES_ADMIN_APPROVAL=true for gated rollouts.
    """
    if settings.ENABLE_MOCK_DATA:
        return False
    raw = os.getenv("REGISTRATION_REQUIRES_ADMIN_APPROVAL")
    if raw is not None and str(raw).strip() != "":
        return env_flag("REGISTRATION_REQUIRES_ADMIN_APPROVAL", default=True)
    return False


def org_has_console_accounts(org: str) -> bool:
    """True when any user record already uses this organisation string (case-insensitive)."""
    name = (org or "").strip()
    if not name:
        return False
    key = name.casefold()
    return any(existing.casefold() == key for existing in registered_organisation_names())


def registered_organisation_names() -> List[str]:
    """Distinct org strings already present in the user directory (case-insensitive dedupe)."""
    from app.core import user_store

    seen: set[str] = set()
    out: List[str] = []
    for rec in user_store.load_all_users().values():
        name = (rec.get("org") or "").strip()
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(name)
    return sorted(out, key=lambda s: s.casefold())


def registration_org_options() -> List[str]:
    raw = (os.getenv("REGISTRATION_ORG_OPTIONS") or "").strip()
    if not raw:
        return list(_DEFAULT_ORGS)
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts or list(_DEFAULT_ORGS)