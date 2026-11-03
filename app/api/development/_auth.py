from fastapi import HTTPException

from app.core.permissions import role_has_permission
from app.core.rbac import rbac_enforced


def require_dev_permission(role: str, perm: str) -> None:
    if not rbac_enforced():
        return
    if not role_has_permission(role, perm):
        raise HTTPException(status_code=403, detail=f"Permission denied: {perm}")
