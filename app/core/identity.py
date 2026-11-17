"""Signup/login identity rules — ASCII only, bounded length, no homoglyphs."""
from __future__ import annotations

import re
import unicodedata

from fastapi import HTTPException

USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._-]{2,31}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,186}\.[A-Za-z]{2,24}$")
USERNAME_MAX = 32
EMAIL_MAX = 254
PASSWORD_MAX = 256


def _ascii_nfc(value: str) -> str:
    nfc = unicodedata.normalize("NFC", value or "")
    if nfc != unicodedata.normalize("NFKC", nfc):
        raise HTTPException(status_code=400, detail="Use plain ASCII letters for this field.")
    if any(ord(ch) > 127 for ch in nfc):
        raise HTTPException(status_code=400, detail="Use plain ASCII letters for this field.")
    return nfc


def normalize_username(raw: str) -> str:
    value = _ascii_nfc((raw or "").strip())
    if len(value) > USERNAME_MAX or not USERNAME_RE.fullmatch(value):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–32 ASCII letters, digits, dot, underscore, or hyphen.",
        )
    return value


def normalize_email(raw: str) -> str:
    value = _ascii_nfc((raw or "").strip().lower())
    if len(value) > EMAIL_MAX or not EMAIL_RE.fullmatch(value):
        raise HTTPException(status_code=400, detail="Enter a valid ASCII email address.")
    return value


def bound_password(raw: str) -> str:
    if raw is None or len(raw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if len(raw) > PASSWORD_MAX:
        raise HTTPException(status_code=400, detail="Password is too long.")
    return raw
