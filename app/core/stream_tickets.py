"""Short-lived opaque tickets for EventSource (SSE) — avoid session token in query strings."""
from __future__ import annotations

import hashlib
import os
import secrets
import threading
import time
from typing import Dict, Optional

_LOCK = threading.Lock()
_TICKETS: Dict[str, Dict[str, float | str]] = {}
TTL_SECONDS = int(os.getenv("STREAM_TICKET_TTL_SECONDS", "180"))


def _hash(ticket: str) -> str:
    return hashlib.sha256(ticket.encode("utf-8")).hexdigest()


def _purge() -> None:
    now = time.time()
    dead = [k for k, v in _TICKETS.items() if float(v.get("expires_at", 0)) < now]
    for k in dead:
        _TICKETS.pop(k, None)


def issue_stream_ticket(session_token: str) -> tuple[str, int]:
    """Bind an opaque ticket to a session token; valid for reconnects until TTL."""
    if not session_token or not str(session_token).startswith("qtok_"):
        raise ValueError("invalid session token")
    ticket = f"st_{secrets.token_urlsafe(24)}"
    with _LOCK:
        _purge()
        _TICKETS[_hash(ticket)] = {
            "session_token": session_token,
            "expires_at": time.time() + TTL_SECONDS,
        }
    return ticket, TTL_SECONDS


def resolve_stream_ticket(ticket: str) -> Optional[str]:
    if not ticket or not ticket.startswith("st_"):
        return None
    key = _hash(ticket.strip())
    with _LOCK:
        _purge()
        rec = _TICKETS.get(key)
    if not rec:
        return None
    if float(rec.get("expires_at", 0)) < time.time():
        return None
    return str(rec.get("session_token") or "") or None


def reset_stream_tickets() -> None:
    """Tests."""
    with _LOCK:
        _TICKETS.clear()
