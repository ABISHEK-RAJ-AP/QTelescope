"""Registration OTP + admin approval gate."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core import user_store
from app.core.registration_otp import consume_registration_otp, issue_registration_otp
from app.api.auth import E2E_CAPTCHA_BYPASS_CODE
from app.main import app


def _captcha(client: TestClient) -> tuple[str, str]:
    r = client.get("/api/v1/auth/captcha")
    assert r.status_code == 200
    return r.json()["captcha_id"], E2E_CAPTCHA_BYPASS_CODE


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("USE_DB_USERS", "false")
    monkeypatch.setenv("E2E_CAPTCHA_BYPASS", "true")
    monkeypatch.setenv("REGISTRATION_REQUIRES_ADMIN_APPROVAL", "false")
    users_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "registered_users.json"
    )
    if os.path.exists(users_path):
        os.remove(users_path)
    with TestClient(app) as c:
        yield c


def test_otp_round_trip_create_active_account(client):
    cid, code = _captcha(client)
    payload = {
        "username": "otpuser1",
        "password": "secret12",
        "email": "otp1@example.com",
        "org": "C-DAC Pune",
        "role": "Operator",
        "full_name": "OTP User",
        "captcha_id": cid,
        "captcha_code": code,
    }
    send = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert send.status_code == 200
    body = send.json()
    assert body["status"] == "SUCCESS"
    assert body.get("screen_otp")
    session_id = body["otp_session_id"]

    confirm = client.post(
        "/api/v1/auth/register/confirm",
        json={"otp_session_id": session_id, "otp_code": body["screen_otp"]},
    )
    confirm_body = confirm.json()
    assert confirm.status_code == 200
    assert confirm_body.get("account_status") == "active"
    assert confirm_body.get("user", {}).get("token")

    users = user_store.load_all_users()
    assert "otpuser1" in users


def test_pending_admin_blocks_login(client, monkeypatch):
    monkeypatch.setenv("REGISTRATION_REQUIRES_ADMIN_APPROVAL", "true")
    cid, code = _captcha(client)
    payload = {
        "username": "pending1",
        "password": "secret12",
        "email": "pending1@example.com",
        "org": "C-DAC",
        "role": "Researcher",
        "captcha_id": cid,
        "captcha_code": code,
    }
    send = client.post("/api/v1/auth/register/send-otp", json=payload)
    otp = send.json()["screen_otp"]
    session_id = send.json()["otp_session_id"]
    assert client.post(
        "/api/v1/auth/register/confirm",
        json={"otp_session_id": session_id, "otp_code": otp},
    ).status_code == 200

    cid2, code2 = _captcha(client)
    login = client.post(
        "/api/v1/auth/login",
        json={
            "username": "pending1",
            "password": "secret12",
            "captcha_id": cid2,
            "captcha_code": code2,
        },
    )
    assert login.status_code == 403


def test_mock_data_forces_screen_delivery_mode(monkeypatch):
    monkeypatch.setenv("ENABLE_MOCK_DATA", "true")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    from app.core.mail_delivery import registration_otp_delivery

    assert registration_otp_delivery() == "screen"


def test_screen_delivery_when_forced_despite_smtp_env(client, monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    monkeypatch.setenv("REGISTRATION_OTP_DELIVERY", "screen")
    cid, code = _captcha(client)
    payload = {
        "username": "screenforce",
        "password": "secret12",
        "email": "screenforce@example.com",
        "org": "C-DAC",
        "role": "Operator",
        "captcha_id": cid,
        "captcha_code": code,
    }
    send = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert send.status_code == 200
    body = send.json()
    assert body["delivery"] == "screen"
    assert body.get("screen_otp")


def test_consume_registration_otp_unit():
    sid, otp, _ = issue_registration_otp(
        email="u@example.com",
        payload={"username": "u", "password_hash": "x"},
    )
    assert consume_registration_otp(sid, otp) is not None
    assert consume_registration_otp(sid, otp) is None