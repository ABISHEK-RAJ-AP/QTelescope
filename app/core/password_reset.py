"""Single-use password reset tokens. No email in lab — token returned only off production."""
from __future__ import annotations

import hashlib
import secrets
import threading
import time
from typing import Any, Dict, Optional

_LOCK = threading.Lock()
_TOKENS: Dict[str, Dict[str, Any]] = {}
TTL_SECONDS = 900


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _purge() -> None:
    now = time.time()
    dead = [k for k, v in _TOKENS.items() if float(v.get("expires_at", 0)) < now]
    for k in dead:
        _TOKENS.pop(k, None)


def issue_reset_token(username: str) -> str:
    token = secrets.token_urlsafe(32)
    with _LOCK:
        _purge()
        _TOKENS[_hash(token)] = {
            "username": username,
            "expires_at": time.time() + TTL_SECONDS,
        }
    return token


def consume_reset_token(token: str) -> Optional[str]:
    key = _hash((token or "").strip())
    with _LOCK:
        _purge()
        rec = _TOKENS.pop(key, None)
    if not rec:
        return None
    return rec.get("username")
