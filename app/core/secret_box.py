"""Fernet envelope for small secrets (MFA TOTP keys) keyed from SECRET_KEY."""
from __future__ import annotations

import base64
import hashlib

from app.core.config import settings

_MFA_FIELD = "secret_enc"


def mfa_secret_field() -> str:
    return _MFA_FIELD


def mfa_encrypt_at_rest() -> bool:
    from app.core.env_profile import env_flag

    return env_flag("MFA_ENCRYPT_AT_REST", default=True)


def _fernet():
    from cryptography.fernet import Fernet

    sk = (settings.SECRET_KEY or "").strip() or "qtelescope-dev-only-mfa-key"
    key = base64.urlsafe_b64encode(hashlib.sha256(sk.encode("utf-8")).digest())
    return Fernet(key)


def seal_plaintext(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def open_ciphertext(token: str) -> str:
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
