import pytest
from fastapi import HTTPException

from app.core.self_registration import (
    reject_client_requested_privileged_role,
    resolve_org_owner_registration_role,
)


def test_org_owner_role_for_new_org(monkeypatch):
    monkeypatch.setenv("USE_DB_USERS", "false")
    assert resolve_org_owner_registration_role(org="Brand New Org · Alpha") == "OrgAdmin"


def test_existing_org_raises(monkeypatch):
    from app.core import user_store

    monkeypatch.setenv("USE_DB_USERS", "false")
    user_store.upsert_user(
        "seed",
        {
            "username": "seed",
            "email": "s@example.com",
            "org": "Taken Org",
            "role": "OrgAdmin",
            "password_hash": "x",
            "account_status": "active",
        },
    )
    with pytest.raises(HTTPException) as exc:
        resolve_org_owner_registration_role(org="Taken Org")
    assert exc.value.status_code == 409


def test_rejects_platform_self_register():
    with pytest.raises(HTTPException) as exc:
        reject_client_requested_privileged_role("PlatformAdmin")
    assert exc.value.status_code == 403


def test_ignores_operator_in_request_body():
    reject_client_requested_privileged_role("Operator")