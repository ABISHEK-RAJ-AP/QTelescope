"""Password-reset email via stdlib SMTP (optional; required for prod delivery)."""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional, Tuple
from urllib.parse import quote

from app.core.config import settings

_log = logging.getLogger("app.mail")


def password_reset_smtp_ready() -> bool:
    return bool((settings.SMTP_HOST or "").strip() and (settings.SMTP_FROM or "").strip())


def password_reset_public_url() -> str:
    return (settings.PUBLIC_APP_URL or "").strip().rstrip("/")


def build_reset_link(token: str) -> str:
    base = password_reset_public_url()
    if not base:
        return f"/reset-password?token={quote(token, safe='')}"
    return f"{base}/reset-password?token={quote(token, safe='')}"


def deliver_password_reset(*, username: str, to_email: str, token: str) -> Tuple[bool, Optional[str]]:
    """Send reset mail. Returns (ok, error_message)."""
    if not password_reset_smtp_ready():
        return False, "SMTP not configured"
    to_email = (to_email or "").strip()
    if not to_email:
        return False, "recipient email missing"

    link = build_reset_link(token)
    msg = EmailMessage()
    msg["Subject"] = "Q-TeleScope password reset"
    msg["From"] = settings.SMTP_FROM.strip()
    msg["To"] = to_email
    msg.set_content(
        f"Password reset was requested for account {username}.\n\n"
        f"Open this link within 15 minutes:\n{link}\n\n"
        "If you did not request this, ignore this message."
    )

    host = settings.SMTP_HOST.strip()
    port = int(settings.SMTP_PORT or 587)
    user = (settings.SMTP_USER or "").strip()
    password = settings.SMTP_PASSWORD or ""
    use_tls = bool(settings.SMTP_USE_TLS)

    try:
        if use_tls and port == 465:
            with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                if use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
    except Exception as exc:
        _log.warning("password reset SMTP failed for %s: %s", username, exc)
        return False, str(exc)
    return True, None
