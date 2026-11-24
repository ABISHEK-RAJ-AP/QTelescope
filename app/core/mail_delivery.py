"""Transactional email via stdlib SMTP (password reset + registration OTP)."""
from __future__ import annotations

import os
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional, Tuple
from urllib.parse import quote

from app.core.config import settings

_log = logging.getLogger("app.mail")


def smtp_configured() -> bool:
    return bool((settings.SMTP_HOST or "").strip() and (settings.SMTP_FROM or "").strip())


def password_reset_smtp_ready() -> bool:
    return smtp_configured()


def registration_smtp_ready() -> bool:
    return smtp_configured()


def registration_otp_delivery() -> str:
    """How registration OTP is delivered: auto (default), email, or screen."""
    mode = (os.getenv("REGISTRATION_OTP_DELIVERY") or "auto").strip().lower()
    if mode == "screen":
        return "screen"
    if mode == "email":
        return "email"
    if settings.ENABLE_MOCK_DATA:
        return "screen"
    return "email" if registration_smtp_ready() else "screen"


def password_reset_public_url() -> str:
    return (settings.PUBLIC_APP_URL or "").strip().rstrip("/")


def build_reset_link(token: str) -> str:
    base = password_reset_public_url()
    if not base:
        return f"/reset-password?token={quote(token, safe='')}"
    return f"{base}/reset-password?token={quote(token, safe='')}"


def _send_smtp_message(msg: EmailMessage) -> Tuple[bool, Optional[str]]:
    if not smtp_configured():
        return False, "SMTP not configured"
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
        _log.warning("SMTP send failed: %s", exc)
        return False, str(exc)
    return True, None


def deliver_password_reset(*, username: str, to_email: str, token: str) -> Tuple[bool, Optional[str]]:
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
    ok, err = _send_smtp_message(msg)
    if not ok:
        _log.warning("password reset SMTP failed for %s: %s", username, err)
    return ok, err


def deliver_registration_otp(*, to_email: str, username: str, code: str, ttl_minutes: int) -> Tuple[bool, Optional[str]]:
    to_email = (to_email or "").strip()
    if not to_email:
        return False, "recipient email missing"

    msg = EmailMessage()
    msg["Subject"] = "Q-TeleScope registration verification code"
    msg["From"] = settings.SMTP_FROM.strip()
    msg["To"] = to_email
    msg.set_content(
        f"Verification code for Q-TeleScope organisation registration ({username}):\n\n"
        f"  {code}\n\n"
        f"This code expires in {ttl_minutes} minutes.\n"
        "If you did not request console access, ignore this message."
    )
    ok, err = _send_smtp_message(msg)
    if not ok:
        _log.warning("registration OTP SMTP failed for %s: %s", username, err)
    return ok, err