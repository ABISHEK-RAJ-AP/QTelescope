"""Capability-based permissions mapped to platform roles (deny-by-default when ENFORCE_RBAC)."""
from __future__ import annotations

from typing import Dict, FrozenSet, List

# resource:action
PERMS = frozenset({
    "users:read", "users:create", "users:update", "users:suspend", "roles:assign",
    "security:read", "security:manage", "sessions:read", "sessions:revoke",
    "audit:read", "audit:export",
    "backends:read", "backends:manage", "telemetry:read",
    "alerts:read", "alerts:acknowledge", "alerts:comment", "alerts:resolve",
    "alert_rules:read", "alert_rules:manage",
    "incidents:read", "incidents:assign", "incidents:update", "incidents:comment",
    "incidents:resolve", "incidents:close",
    "reports:read", "reports:export", "metering:read", "metering:ingest", "metering:export",
    "executions:read", "executions:submit",
    "platform:read", "platform:manage", "providers:manage",
    "projects:read", "projects:create", "projects:update",
    "circuits:read", "circuits:update",
    "simulation:read", "simulation:run",
    "compilation:read", "compilation:run",
    "preflight:read", "preflight:run",
    "submissions:read", "submissions:create", "submissions:submit",
    "estimation:read", "estimation:run",
    "approvals:read", "approvals:decide", "approvals:withdraw", "approvals:override",
    "inventory:read", "inventory:import",
    "providers:onboard", "providers:suspend",
    "policies:read", "dispatch:reconcile",
    "quotas:read", "reservations:read", "reservations:manage",
    "studio:read",
})

DEV_STUDIO = frozenset({
    "projects:read", "projects:create", "projects:update",
    "circuits:read", "circuits:update",
    "simulation:read", "simulation:run",
    "compilation:read", "compilation:run",
    "preflight:read", "preflight:run",
    "submissions:read", "submissions:create", "submissions:submit",
    "estimation:read", "estimation:run",
    "studio:read",
})

GOVERNANCE = frozenset({
    "approvals:read", "approvals:decide", "approvals:withdraw", "approvals:override",
    "inventory:read", "inventory:import",
    "providers:onboard", "providers:suspend",
    "policies:read", "dispatch:reconcile",
    "quotas:read", "reservations:read", "reservations:manage",
})

READ_ONLY = frozenset({
    "backends:read", "telemetry:read", "alerts:read", "incidents:read",
    "reports:read", "quotas:read", "reservations:read", "metering:read", "platform:read", "audit:read",
    "studio:read", "projects:read", "circuits:read", "simulation:read",
})

OPS = READ_ONLY | frozenset({
    "alerts:acknowledge", "alerts:comment", "alerts:resolve",
    "incidents:comment", "incidents:update", "incidents:resolve",
    "reports:export", "metering:export", "executions:read",
})

INCIDENT_CMD = OPS | frozenset({
    "incidents:assign", "incidents:close",
})

OPS_ADMIN = OPS | DEV_STUDIO | GOVERNANCE | frozenset({
    "backends:manage", "alert_rules:read", "alert_rules:manage",
    "providers:manage", "platform:manage", "executions:submit", "dispatch:reconcile",
    "metering:ingest",
})

SECURITY_ADMIN = frozenset({
    "users:read", "users:update", "users:suspend", "roles:assign",
    "security:read", "security:manage", "sessions:read", "sessions:revoke",
    "audit:read", "audit:export", "platform:read",
    "alerts:read", "incidents:read",
})

PLATFORM_ADMIN = PERMS

ROLE_PERMISSIONS: Dict[str, FrozenSet[str]] = {
    # Legacy roles (unchanged login paths)
    "Admin": PLATFORM_ADMIN,
    "Operator": OPS | DEV_STUDIO,
    "Researcher": READ_ONLY | DEV_STUDIO | frozenset({"reports:export", "alerts:comment", "incidents:comment"}),
    # Extended enterprise roles
    "PlatformAdmin": PLATFORM_ADMIN,
    "SecurityAdmin": SECURITY_ADMIN,
    "QuantumOpsAdmin": OPS_ADMIN,
    "IncidentCommander": INCIDENT_CMD,
    "OpsEngineer": OPS,
    "ResearchAnalyst": READ_ONLY | DEV_STUDIO | frozenset({"reports:export", "alerts:comment", "incidents:comment"}),
    "Auditor": frozenset({"audit:read", "audit:export", "users:read", "alerts:read", "incidents:read", "reports:read"}),
    "Viewer": READ_ONLY,
    "Anonymous": frozenset(),
}

ROLE_LABELS: Dict[str, str] = {
    "Admin": "Platform administrator",
    "Operator": "Operations engineer",
    "Researcher": "Research analyst",
    "PlatformAdmin": "Platform administrator",
    "SecurityAdmin": "Security administrator",
    "QuantumOpsAdmin": "Quantum operations administrator",
    "IncidentCommander": "Incident commander",
    "OpsEngineer": "Operations engineer",
    "ResearchAnalyst": "Research analyst",
    "Auditor": "Auditor",
    "Viewer": "Viewer",
}


def permissions_for_role(role: str) -> FrozenSet[str]:
    return ROLE_PERMISSIONS.get(role or "Anonymous", ROLE_PERMISSIONS["Viewer"])


def role_has(role: str, permission: str) -> bool:
    return permission in permissions_for_role(role)


role_has_permission = role_has


def list_assignable_roles() -> List[dict]:
    keys = [
        "Viewer", "ResearchAnalyst", "OpsEngineer", "IncidentCommander",
        "QuantumOpsAdmin", "SecurityAdmin", "PlatformAdmin",
        "Admin", "Operator", "Researcher",
    ]
    seen = set()
    out = []
    for k in keys:
        if k in seen:
            continue
        seen.add(k)
        out.append({"id": k, "label": ROLE_LABELS.get(k, k), "permissions": len(permissions_for_role(k))})
    return out
