"""TOTP MFA secrets (file store; encrypt at rest in production deployments)."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import threading
import time
from typing import Any, Dict, Optional, Tuple

_LOCK = threading.Lock()
_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "user_mfa.json")
_PENDING: Dict[str, Dict[str, Any]] = {}


def _load() -> Dict[str, Dict[str, Any]]:
    path = os.path.abspath(_PATH)
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save(blob: Dict[str, Dict[str, Any]]) -> None:
    path = os.path.abspath(_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(blob, fh, indent=2)
    os.replace(tmp, path)


def _totp_code(secret_b32: str, for_time: Optional[int] = None, digits: int = 6) -> str:
    import hmac
    import struct

    key = base64.b32decode(secret_b32.upper().replace(" ", ""), casefold=True)
    counter = int((for_time or time.time()) // 30)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def verify_totp(secret_b32: str, code: str, window: int = 1) -> bool:
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit() or len(code) not in (6, 8):
        return False
    now = int(time.time())
    for w in range(-window, window + 1):
        if _totp_code(secret_b32, for_time=now + w * 30) == code.zfill(6)[:6]:
            return True
    return False


def mfa_status(username: str) -> Dict[str, Any]:
    rec = _load().get(username) or {}
    return {
        "enabled": bool(rec.get("enabled")),
        "enrolled_at": rec.get("enrolled_at"),
        "has_backup_codes": bool(rec.get("backup_hashes")),
    }


def start_enroll(username: str, issuer: str = "Q-TeleScope") -> Tuple[str, str, str]:
    secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
    otpauth = f"otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}&digits=6&period=30"
    with _LOCK:
        _PENDING[username] = {"secret": secret, "expires": time.time() + 600}
    return secret, otpauth, secret


def confirm_enroll(username: str, code: str) -> Tuple[bool, Optional[list]]:
    with _LOCK:
        pending = _PENDING.pop(username, None)
    if not pending or pending.get("expires", 0) < time.time():
        return False, None
    secret = pending["secret"]
    if not verify_totp(secret, code):
        return False, None
    backups = [secrets.token_hex(4) for _ in range(8)]
    backup_hashes = [hashlib.sha256(c.encode()).hexdigest() for c in backups]
    with _LOCK:
        all_m = _load()
        all_m[username] = {
            "enabled": True,
            "secret": secret,
            "enrolled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "backup_hashes": backup_hashes,
        }
        _save(all_m)
    return True, backups


def verify_login_code(username: str, code: str) -> bool:
    """TOTP or one-time backup code for login step-up."""
    code = (code or "").strip().replace(" ", "")
    if not code:
        return False
    with _LOCK:
        all_m = _load()
        rec = all_m.get(username)
        if not rec or not rec.get("enabled"):
            return False
        secret = rec.get("secret")
        if secret and verify_totp(secret, code):
            return True
        if len(code) >= 6:
            h = hashlib.sha256(code.encode()).hexdigest()
            hashes = list(rec.get("backup_hashes") or [])
            if h in hashes:
                hashes.remove(h)
                rec["backup_hashes"] = hashes
                all_m[username] = rec
                _save(all_m)
                return True
    return False


def disable_mfa(username: str, code: str) -> bool:
    with _LOCK:
        all_m = _load()
        rec = all_m.get(username)
        if not rec or not rec.get("enabled"):
            return True
        if not verify_totp(rec["secret"], code):
            return False
        all_m.pop(username, None)
        _save(all_m)
    return True
