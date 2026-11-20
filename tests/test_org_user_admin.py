"""Organisation-scoped user directory and OrgAdmin role."""
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


def _seed_users():
    user_store.upsert_user(
        "orgadmin_a",
        {
            "username": "orgadmin_a",
            "email": "oa@orga.example",
            "full_name": "Org Admin A",
            "org": "Org Alpha",
            "role": "OrgAdmin",
            "password_hash": "x",
            "account_status": "active",
        },
    )
    user_store.upsert_user(
        "op_a",
        {
            "username": "op_a",
            "email": "op@orga.example",
            "full_name": "Operator A",
            "org": "Org Alpha",
            "role": "Operator",
            "password_hash": "x",
            "account_status": "active",
        },
    )
    user_store.upsert_user(
        "op_b",
        {
            "username": "op_b",
            "email": "op@orgb.example",
            "full_name": "Operator B",
            "org": "Org Beta",
            "role": "Operator",
            "password_hash": "x",
            "account_status": "active",
        },
    )


def test_org_admin_lists_only_own_org(client):
    _seed_users()
    tok = create_session("orgadmin_a", "OrgAdmin", {"org": "Org Alpha"})
    r = client.get("/api/v1/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    names = {u["username"] for u in r.json()}
    assert names == {"orgadmin_a", "op_a"}


def test_platform_admin_lists_all_orgs(client):
    _seed_users()
    tok = create_session("platform", "PlatformAdmin")
    r = client.get("/api/v1/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    names = {u["username"] for u in r.json()}
    assert "op_b" in names and "op_a" in names


def test_org_super_admin_lists_own_org_only(client):
    _seed_users()
    user_store.upsert_user(
        "super_a",
        {
            "username": "super_a",
            "email": "sa@orga.example",
            "full_name": "Super Org A",
            "org": "Org Alpha",
            "role": "SuperAdmin",
            "password_hash": "x",
            "account_status": "active",
        },
    )
    tok = create_session("super_a", "SuperAdmin", {"org": "Org Alpha"})
    r = client.get("/api/v1/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    names = {u["username"] for u in r.json()}
    assert names == {"orgadmin_a", "op_a", "super_a"}


def test_org_admin_invite_forces_org(client):
    _seed_users()
    tok = create_session("orgadmin_a", "OrgAdmin", {"org": "Org Alpha"})
    r = client.post(
        "/api/v1/users/invite",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "username": "invited_alpha",
            "email": "invited_alpha@orga.example",
            "full_name": "Invited",
            "org": "Org Beta",
            "role": "Operator",
            "password": "temppass1",
        },
    )
    assert r.status_code == 403


def test_org_admin_invite_same_org(client):
    _seed_users()
    tok = create_session("orgadmin_a", "OrgAdmin", {"org": "Org Alpha"})
    r = client.post(
        "/api/v1/users/invite",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "username": "invited_alpha",
            "email": "invited_alpha@orga.example",
            "full_name": "Invited",
            "org": "Org Alpha",
            "role": "Operator",
            "password": "temppass1",
        },
    )
    assert r.status_code == 200
    users = user_store.load_all_users()
    assert users["invited_alpha"]["org"] == "Org Alpha"


def test_org_admin_cannot_suspend_other_org(client):
    _seed_users()
    tok = create_session("orgadmin_a", "OrgAdmin", {"org": "Org Alpha"})
    r = client.patch(
        "/api/v1/users/op_b/account-status",
        headers={"Authorization": f"Bearer {tok}"},
        json={"account_status": "suspended"},
    )
    assert r.status_code == 403


def test_org_admin_can_suspend_same_org(client):
    _seed_users()
    tok = create_session("orgadmin_a", "OrgAdmin", {"org": "Org Alpha"})
    r = client.patch(
        "/api/v1/users/op_a/account-status",
        headers={"Authorization": f"Bearer {tok}"},
        json={"account_status": "suspended"},
    )
    assert r.status_code == 200
    assert user_store.load_all_users()["op_a"]["account_status"] == "suspended"