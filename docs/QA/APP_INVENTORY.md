# Q-TeleScope application inventory

Evidence date: 2026-11-05. Scope: `frontend/` + `app/` (not QRP, not qniverse).

## Stack

| Layer | What exists |
| --- | --- |
| Frontend | React + Vite (`frontend/src`), pathname router in `App.jsx` + `appNav.js` |
| Backend | FastAPI `app/main.py`, prefix `/api/v1` |
| DB | SQLAlchemy; default Postgres; SQLite for lab/tests |
| Cache | Redis optional (`REDIS_URL` + `CACHE_ENABLED`); no-op if unset |
| Auth | Bearer `qtok_*` sessions, captcha login, TOTP MFA, password reset |
| Tests | 55+ files under `tests/`; Playwright stub in `tests/e2e/` |

## Frontend routes

Public: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.

Protected `/app/*` (client gate: `localStorage.quantum_user`):

| Path | Component |
| --- | --- |
| `/app/overview` | DashboardHome |
| `/app/operate` | OperationsCentre |
| `/app/platform/health` | PlatformHealth |
| `/app/investigate/timeline` | OpsTimeline |
| `/app/backends/inventory` | BackendInventory |
| `/app/backends/details/:id[/:tab]` | BackendDetails |
| `/app/telemetry/{live,calibration,drift,trends,topology,cal-timeline,compare,anomalies,replay,metrics}` | matching pages |
| `/app/execution/{jobs,queues}` | JobMonitoring, QueueMonitoring |
| `/app/resources/{health,environment,capabilities}` | ResourceHealth, EnvironmentPage, DeviceCapabilities |
| `/app/alerts`, `/app/alerts/incidents`, detail routes | AlertsEvents, AlertDetailPage, IncidentDetailPage |
| `/app/reports` | ReportsPage |
| `/app/settings` | UserSettings |
| `/app/admin/{integrations,collectors,rules,users}` | AdministrationPage (Admin UI) |
| `/app/onboarding` | OnboardingFlow |

## Backend routers (`/api/v1`)

backends, device-capabilities, topology, qubits, calibration, drift, queues, jobs, health, alerts, incidents, operations, admin, reports, evidence, metrics, infra, federated, anomalies, replay, research, events, auth, users, environment, development/*, governance/*.

Root: `GET /`, `/healthz`, `/readyz`.

## Persistence

- ORM tables via Alembic (`USE_ALEMBIC`) or `create_all` (SQLite lab).
- JSON files under `data/`: users, MFA, optional sessions.
- Redis: cache + auth rate-limit when `REDIS_URL` set.

## Mocks

`ENABLE_MOCK_DATA=true` (default in `.env.example`) seeds simulated backends. Not live IBM/IonQ unless tokens set.

## Auth lifecycle (after 2026-11-05 fixes)

Login + captcha → optional TOTP (`MFA_REQUIRED`) → session. Forgot/reset password. Change password on Settings. Logout revokes bearer token.
