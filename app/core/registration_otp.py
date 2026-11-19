"""Short-lived OTP sessions for self-service registration."""
from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from typing import Any, Dict, Optional, Tuple

_LOCK = threading.Lock()
_PENDING: Dict[str, Dict[str, Any]] = {}

OTP_TTL_SECONDS = int(__import__("os").getenv("REGISTRATION_OTP_TTL_SECONDS", "600") or "600")
OTP_LENGTH = 6


def _otp_secret() -> bytes:
    from app.core.config import settings

    raw = (settings.SECRET_KEY or "qtelescope-registration-otp").encode("utf-8")
    return raw


def _hash_otp(code: str) -> str:
    digest = hmac.new(_otp_secret(), (code or "").strip().encode("utf-8"), hashlib.sha256).hexdigest()
    return digest


def _cleanup_locked() -> None:
    now = time.time()
    expired = [sid for sid, row in _PENDING.items() if float(row.get("expires_at") or 0) < now]
    for sid in expired:
        _PENDING.pop(sid, None)


def issue_registration_otp(*, email: str, payload: Dict[str, Any]) -> Tuple[str, str, int]:
    """Returns (session_id, plaintext_otp, ttl_seconds)."""
    code = "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))
    session_id = secrets.token_urlsafe(18)
    expires_at = time.time() + max(60, OTP_TTL_SECONDS)
    with _LOCK:
        _cleanup_locked()
        _PENDING[session_id] = {
            "expires_at": expires_at,
            "email": (email or "").strip().lower(),
            "otp_hash": _hash_otp(code),
            "payload": dict(payload),
            "attempts": 0,
        }
    return session_id, code, OTP_TTL_SECONDS


def peek_registration_session(session_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        _cleanup_locked()
        row = _PENDING.get((session_id or "").strip())
        if not row:
            return None
        if float(row.get("expires_at") or 0) < time.time():
            _PENDING.pop((session_id or "").strip(), None)
            return None
        return dict(row)


def consume_registration_otp(session_id: str, code: str) -> Optional[Dict[str, Any]]:
    sid = (session_id or "").strip()
    submitted = (code or "").strip()
    if not sid or not submitted:
        return None
    with _LOCK:
        _cleanup_locked()
        row = _PENDING.get(sid)
        if not row:
            return None
        if float(row.get("expires_at") or 0) < time.time():
            _PENDING.pop(sid, None)
            return None
        attempts = int(row.get("attempts") or 0) + 1
        row["attempts"] = attempts
        if attempts > 8:
            _PENDING.pop(sid, None)
            return None
        if not hmac.compare_digest(str(row.get("otp_hash") or ""), _hash_otp(submitted)):
            return None
        payload = dict(row.get("payload") or {})
        _PENDING.pop(sid, None)
        return payload