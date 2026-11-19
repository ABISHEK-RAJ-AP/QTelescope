"""Public signup: limited roles only — admins assign elevated roles in Users & roles."""
from __future__ import annotations

from fastapi import HTTPException

_SELF_REGISTER = frozenset({"Operator", "Researcher", "OpsEngineer", "ResearchAnalyst"})


def resolve_self_registration_role(requested: str | None) -> str:
    r = (requested or "Operator").strip()
    if r not in _SELF_REGISTER:
        raise HTTPException(
            status_code=400,
            detail="Invalid access request. Choose operations or research. Platform administrator roles are assigned by your organisation admin.",
        )
    if r in ("Researcher", "ResearchAnalyst"):
        return "Researcher"
    return "Operator"