import os

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.sessions import create_session, get_session, require_api_auth, revoke_session
from app.core.api_auth import ApiAuthMiddleware


def test_session_create_and_revoke():
    tok = create_session("alice", "Operator", {"email": "a@x.com"})
    assert tok.startswith("qtok_")
    sess = get_session(tok)
    assert sess and sess["username"] == "alice" and sess["role"] == "Operator"
    assert revoke_session(tok)
    assert get_session(tok) is None


def test_api_auth_middleware_blocks(monkeypatch):
    monkeypatch.setenv("REQUIRE_API_AUTH", "true")
    app = FastAPI()
    app.add_middleware(ApiAuthMiddleware)

    @app.get("/api/v1/backends")
    def backends():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/api/v1/backends").status_code == 401
    tok = create_session("bob", "Admin")
    assert client.get("/api/v1/backends", headers={"Authorization": f"Bearer {tok}"}).status_code == 200


def test_register_rejects_admin_role(monkeypatch):
    import uuid

    from app.api import auth as auth_mod
    from app.api.auth import router as auth_router
    from app.core.config import settings

    monkeypatch.setattr(auth_mod, "_consume_captcha", lambda _a, _b: None)
    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    client = TestClient(app)
    uname = f"reg_{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "password": "secret12",
            "email": f"{uname}@example.com",
            "role": "Admin",
            "captcha_id": "cap_test",
            "captcha_code": "ABCD",
        },
    )
    assert resp.status_code == 403


def test_register_operator_success(monkeypatch):
    import uuid

    from app.api import auth as auth_mod
    from app.api.auth import router as auth_router
    from app.core.config import settings

    monkeypatch.setattr(auth_mod, "_consume_captcha", lambda _a, _b: None)
    app = FastAPI()
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    client = TestClient(app)
    uname = f"op_{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "password": "secret12",
            "email": f"{uname}@example.com",
            "full_name": "Test Operator",
            "org": "Lab",
            "role": "Operator",
            "captcha_id": "cap_test",
            "captcha_code": "ABCD",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "SUCCESS"
    assert body["user"]["username"] == uname
    assert body["user"]["role"] == "Operator"
