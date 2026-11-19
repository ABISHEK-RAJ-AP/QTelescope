import pytest
from fastapi import HTTPException

from app.core.self_registration import resolve_self_registration_role


def test_resolve_research():
    assert resolve_self_registration_role("Researcher") == "Researcher"
    assert resolve_self_registration_role("ResearchAnalyst") == "Researcher"


def test_resolve_ops():
    assert resolve_self_registration_role("Operator") == "Operator"
    assert resolve_self_registration_role("OpsEngineer") == "Operator"
    assert resolve_self_registration_role(None) == "Operator"


def test_rejects_admin_self_service():
    with pytest.raises(HTTPException) as exc:
        resolve_self_registration_role("SuperAdmin")
    assert exc.value.status_code == 400