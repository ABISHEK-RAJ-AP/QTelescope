"""Server-side API sessions (in-memory + optional file persist)."""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from typing import Any, Dict, Optional

_LOCK = threading.Lock()
_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", str(24 * 3600)))
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
_SESSIONS_PATH = os.path.join(_DATA_DIR, "api_sessions.json")


def _now() -> float:
    return time.time()


def _persist_enabled() -> bool:
    return os.getenv("PERSIST_API_SESSIONS", "false").lower() in ("1", "true", "yes")


def _load_file() -> None:
    if not _persist_enabled() or not os.path.isfile(_SESSIONS_PATH):
        return
    try:
        with open(_SESSIONS_PATH, "r", encoding="utf-8") as fh:
            blob = json.load(fh)
        if isinstance(blob, dict):
            _SESSIONS.update(blob)
    except (OSError, json.JSONDecodeError):
        pass


def _save_file() -> None:
    if not _persist_enabled():
        return
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _SESSIONS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(_SESSIONS, fh)
    os.replace(tmp, _SESSIONS_PATH)


def _purge_expired() -> None:
    now = _now()
    dead = [t for t, s in _SESSIONS.items() if float(s.get("expires_at", 0)) < now]
    for t in dead:
        _SESSIONS.pop(t, None)


def create_session(username: str, role: str, extra: Optional[Dict[str, Any]] = None) -> str:
    token = f"qtok_{uuid.uuid4().hex}"
    record = {
        "session_id": uuid.uuid4().hex,
        "username": username,
        "role": role,
        "created_at": _now(),
        "expires_at": _now() + SESSION_TTL_SECONDS,
    }
    if extra:
        record.update({k: v for k, v in extra.items() if k not in record})
    with _LOCK:
        _load_file()
        _purge_expired()
        _SESSIONS[token] = record
        _save_file()
    return token


def get_session(token: str) -> Optional[Dict[str, Any]]:
    if not token or not token.startswith("qtok_"):
        return None
    with _LOCK:
        _load_file()
        _purge_expired()
        rec = _SESSIONS.get(token)
        if not rec:
            return None
        if float(rec.get("expires_at", 0)) < _now():
            _SESSIONS.pop(token, None)
            _save_file()
            return None
        return dict(rec)


def revoke_session(token: str) -> bool:
    with _LOCK:
        if token in _SESSIONS:
            _SESSIONS.pop(token, None)
            _save_file()
            return True
    return False


def list_user_sessions(username: str, current_token: Optional[str] = None) -> list:
    with _LOCK:
        _load_file()
        _purge_expired()
        out = []
        for tok, rec in _SESSIONS.items():
            if rec.get("username") != username:
                continue
            out.append({
                "session_id": rec.get("session_id") or tok[-12:],
                "created_at": rec.get("created_at"),
                "expires_at": rec.get("expires_at"),
                "role": rec.get("role"),
                "current": tok == current_token,
            })
        out.sort(key=lambda r: float(r.get("created_at") or 0), reverse=True)
        return out


def revoke_session_for_user(username: str, session_id: str, current_token: Optional[str] = None) -> bool:
    with _LOCK:
        _load_file()
        for tok, rec in list(_SESSIONS.items()):
            if rec.get("username") != username:
                continue
            sid = rec.get("session_id") or tok
            if sid != session_id and tok != session_id:
                continue
            if tok == current_token:
                return False
            _SESSIONS.pop(tok, None)
            _save_file()
            return True
    return False


def revoke_other_sessions(username: str, current_token: str) -> int:
    n = 0
    with _LOCK:
        _load_file()
        for tok, rec in list(_SESSIONS.items()):
            if rec.get("username") != username or tok == current_token:
                continue
            _SESSIONS.pop(tok, None)
            n += 1
        if n:
            _save_file()
    return n


def require_api_auth() -> bool:
    from app.core.env_profile import env_flag_prod_default_true

    return env_flag_prod_default_true("REQUIRE_API_AUTH")
