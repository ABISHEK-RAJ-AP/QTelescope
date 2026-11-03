# Q-TeleScope — RBAC & identity (implementation snapshot)

## Roles (backend: `app/core/permissions.py`)

| Role | Intent |
|------|--------|
| Admin / PlatformAdmin | Full platform capabilities |
| SecurityAdmin | Users, security, sessions, audit (no quantum ops config by default) |
| QuantumOpsAdmin | Backends, alert rules, providers, operational actions |
| IncidentCommander | Incident assign/close + ops alert/incident response |
| OpsEngineer / Operator | Acknowledge, resolve, comment on alerts/incidents |
| ResearchAnalyst / Researcher | Read telemetry + export; limited comment |
| Auditor | Read-only audit and history |
| Viewer | Read-only monitoring |

Legacy login roles **Admin**, **Operator**, **Researcher** map to the extended permission sets above.

## Permission model

Capabilities use `resource:action` (e.g. `alerts:acknowledge`, `incidents:resolve`, `users:read`).  
Backend enforcement: `require_permission()` in `app/core/rbac.py`. Set `ENFORCE_RBAC=true` to deny-by-default on protected routes.

Frontend mirrors permissions via `/auth/me` → `permissions[]` and `can(user, perm)` in `frontend/src/lib/permissions.js`.

## User-facing surfaces

| Surface | Route / API |
|---------|-------------|
| Account settings (profile, MFA, prefs) | `/app/settings`, `/users/me*` |
| User directory (admin) | Configure → Users & roles, `GET /users`, `PATCH /users/{username}/role` |
| MFA (TOTP) | Settings → Security; secrets in `data/user_mfa.json` (encrypted at rest in file) |

Cert Studio was used as a **workflow reference** (profile tabs, TOTP enroll, preferences)—not a UI clone.

## Alerts & incidents UX

- KPI strip + 24h detection chart + separated Alerts / Incidents switcher
- Table/grid row or card click → full **workspace** pages (Cert Studio–style investigation flow)
- Drawer remains fallback when deep-link handler is unavailable
- Actions and discussion gated by permissions; comments store author **role** for attribution
- Permissions: `alerts:comment`, `incidents:comment`, `alerts:acknowledge`, `alerts:resolve`, `incidents:update`, `incidents:resolve`

## Alert workspace

- List: `/app/alerts`
- Detail: `/app/alerts/detail/{alert_id}` — threshold chart, activity timeline, investigation links, discussion
- API: `GET /alerts/{id}` (alert + optional `incident_id` + comments), `POST /alerts/{id}/comments` (`alerts:comment`)

## Incident workspace

- List: `/app/alerts/incidents` (card grid or table)
- Detail: `/app/alerts/incidents/{incident_id}` — timeline, severity chart, related alerts (click → alert workspace), discussion
- API: `GET /incidents/{id}` returns linked alerts + comments; `POST /incidents/{id}/comments` (`incidents:comment`)

## Sessions

- `GET /users/me/sessions`, `DELETE /users/me/sessions/{session_id}`, `POST /users/me/sessions/revoke-others`
- UI: Account settings → Security → Active sessions

## Not yet implemented (master spec backlog)

- MFA challenge at login, WebAuthn
- Correlation graph, investigation tasks, dedicated audit log UI
- Alert rules correlation policy editor
- DB-backed users/MFA (still JSON stores for prefs/MFA)
- Comprehensive automated RBAC test suite
