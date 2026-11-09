"""Production forgot-password must email via SMTP, never return dev_reset_token."""
import uuid
from unittest.mock import MagicMock, patch

from app.core import mail_delivery


def test_build_reset_link_uses_public_app_url(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "https://ts.example.com")
    link = mail_delivery.build_reset_link("tok_abc")
    assert link.startswith("https://ts.example.com/reset-password?token=")


def test_prod_forgot_sends_smtp_no_dev_token(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api import auth as auth_mod
    from app.api.auth import router as auth_router
    from app.core.config import settings

    monkeypatch.setenv("QRE_PROFILE", "production")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr(settings, "SMTP_FROM", "noreply@test")
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "https://app.test")
    monkeypatch.setattr(auth_mod, "_consume_captcha", lambda _a, _b: None)

    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    client = TestClient(app)

    uname = f"mail_{uuid.uuid4().hex[:8]}"
    email = f"{uname}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "password": "passw0rd",
            "email": email,
            "captcha_id": "cap",
            "captcha_code": "ABCD",
        },
    )

    smtp_instance = MagicMock()
    with patch("app.core.mail_delivery.smtplib.SMTP") as smtp_cls:
        smtp_cls.return_value.__enter__.return_value = smtp_instance
        resp = client.post("/api/v1/auth/password/forgot", json={"username": uname})

    assert resp.status_code == 200
    assert "dev_reset_token" not in resp.json()
    smtp_instance.send_message.assert_called_once()
    sent = smtp_instance.send_message.call_args[0][0]
    assert email in sent["To"]
    assert "reset-password" in sent.get_content()
