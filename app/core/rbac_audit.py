"""Route ↔ role matrix for national readiness audits."""

MUTATING_ROUTES = [
    {"method": "POST", "path": "/admin/credentials/*", "min_role": "Admin", "wired": True},
    {"method": "POST", "path": "/admin/alert-rules", "min_role": "Admin", "wired": True},
    {"method": "PUT", "path": "/admin/alert-rules/*", "min_role": "Admin", "wired": True},
    {"method": "DELETE", "path": "/admin/alert-rules/*", "min_role": "Admin", "wired": True},
    {"method": "POST", "path": "/admin/auto-discover", "min_role": "Admin", "wired": True},
    {"method": "PUT", "path": "/admin/collection-schedules", "min_role": "Admin", "wired": True},
    {"method": "POST", "path": "/admin/ibm-token", "min_role": "Admin", "wired": True},
    {"method": "POST", "path": "/health/qubits/*/quarantine", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/health/qubits/*/release", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/health/router/apply", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/evidence/snapshots", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/environment/import", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/environment/ingest", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/environment/inbox/scan", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/federated/snapshots/import", "min_role": "Admin", "wired": True},
    {"method": "POST", "path": "/incidents/sync", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/incidents/*/acknowledge", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/incidents/*/investigate", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/incidents/*/resolve", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/alerts/*/acknowledge", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/alerts/*/resolve", "min_role": "Operator", "wired": True},
    {"method": "POST", "path": "/reports/import", "min_role": "Operator", "wired": True},
]


def rbac_audit_report() -> dict:
    from app.core.rbac import rbac_enforced

    return {
        "enforce_rbac": rbac_enforced(),
        "header": "Authorization: Bearer + X-User-Role (legacy dev)",
        "roles": ["Admin", "Operator", "Researcher"],
        "require_api_auth": __import__("app.core.sessions", fromlist=["require_api_auth"]).require_api_auth(),
        "note": "Role from validated session when Bearer token present. ENFORCE_RBAC gates mutators.",
        "routes": MUTATING_ROUTES,
    }
