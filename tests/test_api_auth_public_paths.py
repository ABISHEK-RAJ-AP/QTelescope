"""Public auth paths must stay reachable without a session when API auth is on."""
from app.core.api_auth import _is_public_path
from app.core.config import settings


def test_registration_flow_paths_are_public():
    prefix = settings.API_V1_STR
    for suffix in (
        "/auth/registration-options",
        "/auth/register/send-otp",
        "/auth/register/confirm",
        "/auth/captcha",
    ):
        assert _is_public_path(f"{prefix}{suffix}") is True