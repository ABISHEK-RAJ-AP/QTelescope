"""Login MFA step-up, password reset, change password."""
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import auth as auth_mod
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.core.config import settings
from app.core.sessions import create_session
from app.core import user_mfa, user_store


def _client(monkeypatch):
    monkeypatch.setattr(auth_mod, "_consume_captcha", lambda _a, _b: None)
    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    app.include_router(users_router, prefix=settings.API_V1_STR)
    return TestClient(app)


def test_mfa_required_then_totp(monkeypatch, tmp_path):
    monkeypatch.setattr(user_mfa, "_PATH", str(tmp_path / "mfa.json"))
    client = _client(monkeypatch)
    uname = f"mfa_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "password": "secret12",
            "email": f"{uname}@example.com",
            "captcha_id": "cap",
            "captcha_code": "ABCD",
        },
    )
    secret, _, _ = user_mfa.start_enroll(uname)
    code = user_mfa._totp_code(secret)
    ok, _ = user_mfa.confirm_enroll(uname, code)
    assert ok

    first = client.post(
        "/api/v1/auth/login",
        json={
            "username": uname,
            "password": "secret12",
            "captcha_id": "cap",
            "captcha_code": "ABCD",
        },
    )
    assert first.status_code == 200
    body = first.json()
    assert body["status"] == "MFA_REQUIRED"
    assert body.get("mfa_token")
    assert "user" not in body or not body.get("user", {}).get("token")

    bad = client.post(
        "/api/v1/auth/login/mfa",
        json={"mfa_token": body["mfa_token"], "code": "000000"},
    )
    assert bad.status_code == 401

    totp = user_mfa._totp_code(secret)
    ok_login = client.post(
        "/api/v1/auth/login/mfa",
        json={"mfa_token": body["mfa_token"], "code": totp},
    )
    assert ok_login.status_code == 200
    assert ok_login.json()["status"] == "SUCCESS"
    assert ok_login.json()["user"]["token"].startswith("qtok_")


def test_forgot_password_hides_existence(monkeypatch):
    client = _client(monkeypatch)
    missing = client.post("/api/v1/auth/password/forgot", json={"username": "no_such_user_zzz"})
    assert missing.status_code == 200
    assert "dev_reset_token" not in missing.json()
    assert "account exists" in missing.json()["message"].lower() or "reset" in missing.json()["message"].lower()


def test_password_reset_and_login(monkeypatch):
    client = _client(monkeypatch)
    uname = f"pw_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "password": "oldpass1",
            "email": f"{uname}@example.com",
            "captcha_id": "cap",
            "captcha_code": "ABCD",
        },
    )
    forgot = client.post("/api/v1/auth/password/forgot", json={"username": uname})
    token = forgot.json()["dev_reset_token"]
    reset = client.post(
        "/api/v1/auth/password/reset",
        json={"token": token, "new_password": "newpass1", "confirm_password": "newpass1"},
    )
    assert reset.status_code == 200
    reuse = client.post(
        "/api/v1/auth/password/reset",
        json={"token": token, "new_password": "newpass2", "confirm_password": "newpass2"},
    )
    assert reuse.status_code == 400
    login = client.post(
        "/api/v1/auth/login",
        json={
            "username": uname,
            "password": "newpass1",
            "captcha_id": "cap",
            "captcha_code": "ABCD",
        },
    )
    assert login.status_code == 200
    assert login.json()["status"] == "SUCCESS"


def test_change_password_requires_current(monkeypatch):
    client = _client(monkeypatch)
    uname = f"chg_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "password": "oldpass1",
            "email": f"{uname}@example.com",
            "captcha_id": "cap",
            "captcha_code": "ABCD",
        },
    )
    tok = create_session(uname, "Operator")
    headers = {"Authorization": f"Bearer {tok}"}
    bad = client.post(
        "/api/v1/users/me/password",
        headers=headers,
        json={"current_password": "wrong", "new_password": "newpass1", "confirm_password": "newpass1"},
    )
    assert bad.status_code == 401
    ok = client.post(
        "/api/v1/users/me/password",
        headers=headers,
        json={"current_password": "oldpass1", "new_password": "newpass1", "confirm_password": "newpass1"},
    )
    assert ok.status_code == 200
    rec = user_store.load_all_users()[uname]
    assert rec["password_hash"] == auth_mod._hash_password("newpass1")
