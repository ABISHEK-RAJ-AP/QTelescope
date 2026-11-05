# RBAC matrix

Source: `app/core/permissions.py`, `app/core/rbac.py`. Enforcement: `ENFORCE_RBAC` (on by default when `ENVIRONMENT=production`).

## Login roles (wired)

| Role | Typical access |
| --- | --- |
| Admin | All `PERMS` |
| Operator | Ops + Build studio |
| Researcher | Read + studio + limited comments/export |

## Catalog roles (assignable in admin)

Viewer, ResearchAnalyst, OpsEngineer, IncidentCommander, QuantumOpsAdmin, SecurityAdmin, PlatformAdmin, plus legacy Admin/Operator/Researcher.

## Frontend vs backend

| Control | Enforced where |
| --- | --- |
| `/app/admin/*` hidden unless `role === 'Admin'` | UI only (`App.jsx`) |
| `require_admin` / `require_permission` | API when `ENFORCE_RBAC` |
| `REQUIRE_API_AUTH` | Middleware; public: login, register, captcha, config-status, password forgot/reset, login/mfa |

Lab default: RBAC off unless production profile. VAPT must set `ENFORCE_RBAC=true` and `REQUIRE_API_AUTH=true`.

## Privileged actions

| Action | Permission / role |
| --- | --- |
| List users / assign role | Admin |
| Collector / provider config | platform:manage / Admin |
| Acknowledge/resolve alerts | alerts:acknowledge / resolve |
| Evidence export | reports:export |
| Self role change | Blocked for demoting own Admin |

Do not treat UI hide as authorization. Direct API tests required with `ENFORCE_RBAC=true`.
