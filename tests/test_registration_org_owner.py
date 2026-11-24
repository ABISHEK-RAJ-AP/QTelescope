"""Organisation owner self-registration → OrgAdmin; existing org blocked."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.api.auth import E2E_CAPTCHA_BYPASS_CODE
from app.core import user_store
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
    users_path = os.path.join(os.path.dirname(__file__), "..", "data", "registered_users.json")
    if os.path.exists(users_path):
        os.remove(users_path)
    with TestClient(app) as c:
        yield c


def _register_org(client: TestClient, *, org: str, username: str, email: str):
    cid, code = _captcha(client)
    send = client.post(
        "/api/v1/auth/register/send-otp",
        json={
            "username": username,
            "password": "secret12",
            "email": email,
            "org": org,
            "role": "Operator",
            "captcha_id": cid,
            "captcha_code": code,
        },
    )
    assert send.status_code == 200, send.text
    body = send.json()
    otp = body.get("screen_otp") or body.get("otp")
    assert body.get("screen_otp")
    confirm = client.post(
        "/api/v1/auth/register/confirm",
        json={"otp_session_id": body["otp_session_id"], "otp_code": body["screen_otp"]},
    )
    assert confirm.status_code == 200, confirm.text
    return confirm.json()


def test_new_org_becomes_org_admin(client):
    out = _register_org(
        client,
        org="University · Karnataka · Test IIT",
        username="orgowner1",
        email="owner1@example.com",
    )
    assert out.get("user", {}).get("role") == "OrgAdmin"
    users = user_store.load_all_users()
    assert users["orgowner1"]["role"] == "OrgAdmin"
    assert users["orgowner1"]["org"] == "University · Karnataka · Test IIT"


def test_second_registration_same_org_blocked(client):
    _register_org(client, org="Private enterprise · Acme Lab", username="owner_acme", email="a@acme.example")
    cid, code = _captcha(client)
    r = client.post(
        "/api/v1/auth/register/send-otp",
        json={
            "username": "other_user",
            "password": "secret12",
            "email": "other@acme.example",
            "org": "Private enterprise · Acme Lab",
            "captcha_id": cid,
            "captcha_code": code,
        },
    )
    assert r.status_code == 409


def test_platform_admin_role_rejected_on_register(client):
    cid, code = _captcha(client)
    r = client.post(
        "/api/v1/auth/register/send-otp",
        json={
            "username": "badadmin",
            "password": "secret12",
            "email": "bad@example.com",
            "org": "Startup · Brand New Co",
            "role": "PlatformAdmin",
            "captcha_id": cid,
            "captcha_code": code,
        },
    )
    assert r.status_code == 403


def test_registration_options_declares_org_owner(client):
    r = client.get("/api/v1/auth/registration-options")
    assert r.status_code == 200
    body = r.json()
    assert body.get("self_registration_role") == "OrgAdmin"
    assert body.get("self_registration_scope") == "new_organisation_only"