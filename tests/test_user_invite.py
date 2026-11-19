"""Admin invite creates active accounts."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core import user_store
from app.core.sessions import create_session
from app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("USE_DB_USERS", "false")
    users_path = os.path.join(os.path.dirname(__file__), "..", "data", "registered_users.json")
    if os.path.exists(users_path):
        os.remove(users_path)
    with TestClient(app) as c:
        yield c


def test_admin_invite_user(client):
    tok = create_session("admin", "Admin")
    headers = {"Authorization": f"Bearer {tok}"}
    r = client.post(
        "/api/v1/users/invite",
        headers=headers,
        json={
            "username": "invited1",
            "email": "invited1@example.com",
            "full_name": "Invited Operator",
            "org": "C-DAC Pune",
            "role": "Operator",
            "password": "temppass1",
        },
    )
    assert r.status_code == 200
    assert r.json().get("account_status") == "active"
    users = user_store.load_all_users()
    assert users["invited1"]["account_status"] == "active"