# Q-TeleScope baseline inventory

**Evidence date:** 2026-11-09  
**Git:** branch `main`, commit `de4707d` (local ahead of `origin`; uncommitted work in S4–S6 slice)  
**Scope:** `frontend/`, `app/`, `tests/` (excludes QRP, qniverse, govern app)

## 1. Stack (verified)

| Layer | Technology | Entry |
| --- | --- | --- |
| Frontend | React 19 + Vite | `frontend/src/main.jsx` |
| Routing | react-router + `App.jsx` state | `/`, `/login`, `/app/*` |
| Backend | FastAPI + SQLAlchemy | `app/main.py` |
| DB | PostgreSQL-oriented; SQLite lab | `app/core/database.py` |
| Tests | Vitest, pytest, Playwright | `npm test`, `pytest`, `scripts/run-e2e-telescope.sh` |

## 2. Public routes

| Route | Component | Classification | Evidence |
| --- | --- | --- | --- |
| `/` | `LandingPage.jsx` | PARTIAL | Factual capability copy; not authenticated app |
| `/login` | `LoginPage.jsx` | COMPLETE (lab) | E01–E05 Playwright |
| `/register` | `RegisterPage.jsx` | PARTIAL | |
| `/forgot-password` | `ForgotPasswordPage.jsx` | PARTIAL | E04; delivery channel env-dependent |
| `/reset-password` | `ResetPasswordPage.jsx` | PARTIAL | |

## 3. Protected `/app/*` routes

Source: `frontend/src/appNav.js`, `CommandPalette.jsx`, `docs/QA/SPRINT2_ROUTE_AUDIT.md`, `App.jsx` `mainTopic` switch.

| Path | Page | Classification | Load / error | Notes |
| --- | --- | --- | --- | --- |
| `/app/overview` | DashboardHome | PARTIAL | skeleton / ErrorState | Widget layout; provenance on charts |
| `/app/operate` | OperationsCentre | PARTIAL | skeleton | Operator lanes |
| `/app/platform/health` | PlatformHealth | PARTIAL | skeleton / ErrorState | EDT providers; SLI + synthetic v1 |
| `/app/investigate/timeline` | OpsTimeline | PARTIAL | skeleton / ErrorState | |
| `/app/backends/inventory` | BackendInventory | PARTIAL | skeleton / ErrorState | E06 |
| `/app/backends/details/:id` | BackendDetails | PARTIAL | per-tab | Workspace tabs; ingestion chip |
| `/app/telemetry/live` | LiveTelemetry | PARTIAL | skeleton / SSE | E09 |
| `/app/telemetry/explorer` | MetricsExplorer | PARTIAL | skeleton | E26 localStorage saves |
| `/app/telemetry/calibration` | CalibrationStatus | PARTIAL | skeleton | EDT table layout |
| `/app/telemetry/drift` | DriftAnalysis | PARTIAL | skeleton | |
| `/app/telemetry/trends` | HistoricalTrends | PARTIAL | skeleton | |
| `/app/telemetry/topology` | TopologyExplorer | PARTIAL | skeleton | |
| `/app/telemetry/compare` | BackendComparison | PARTIAL | skeleton | |
| `/app/telemetry/anomalies` | AnomalyMonitor | PARTIAL | skeleton | |
| `/app/telemetry/replay` | TemporalReplay | PARTIAL | skeleton | |
| `/app/telemetry/metrics` | MetricsCoverage | PARTIAL | skeleton | Matrix, not EDT |
| `/app/execution/jobs` | JobMonitoring | PARTIAL | skeleton | EDT table; E13 drawer |
| `/app/execution/queues` | QueueMonitoring | PARTIAL | skeleton | E14 |
| `/app/resources/health` | ResourceHealth | PARTIAL | skeleton | Qubit heatmap |
| `/app/resources/environment` | EnvironmentPage | PARTIAL | skeleton | |
| `/app/resources/capabilities` | DeviceCapabilities | PARTIAL | skeleton | |
| `/app/alerts` | AlertsEvents | PARTIAL | skeleton | Grouped table + EDT incidents |
| `/app/alerts/detail/:id` | AlertDetailPage | PARTIAL | | Related logs link |
| `/app/alerts/incidents` | AlertsEvents | PARTIAL | | EDT table layout |
| `/app/alerts/incidents/:id` | IncidentDetailPage | PARTIAL | | E11–E12 |
| `/app/reports` | ReportsPage | PARTIAL | skeleton | E15–E16 |
| `/app/settings` | UserSettings | PARTIAL | | MFA, prefs |
| `/app/admin/integrations` | AdministrationPage | PARTIAL | skeleton | |
| `/app/admin/collectors` | AdministrationPage | PARTIAL | | B07 JSONL history |
| `/app/admin/rules` | AdministrationPage | PARTIAL | | |
| `/app/admin/users` | AdministrationPage | PARTIAL | | E19 |
| `/app/admin/logs` | AdministrationPage | PARTIAL | | Audit + app tabs E25 |
| `/app/onboarding` | OnboardingFlow | PARTIAL | | Tour |

## 4. Backend API surface (sample)

| Area | Router prefix | Classification |
| --- | --- | --- |
| Auth / users | `/api/v1/users`, login | PARTIAL — MFA, sessions tested in pytest/E2E |
| Backends / telemetry | `/api/v1/backends`, telemetry | PARTIAL — mock + live lineage |
| Operations | `/api/v1/operations` | PARTIAL — platform-health aggregates |
| Admin observability | `/api/v1/admin/*` | PARTIAL — executions, quality, logs |
| Alerts / incidents | `/api/v1/alerts`, incidents | PARTIAL | |
| Jobs / queues | `/api/v1/jobs` | PARTIAL — synthetic job records |
| Reports / evidence | `/api/v1/reports` | PARTIAL | |

Full OpenAPI: run API and open `/docs` (verified HTTP 200 in lab).

## 5. Design system state

| Artefact | Path | Status |
| --- | --- | --- |
| Tokens | `frontend/src/styles/design-tokens.css`, `index.css` | PARTIAL — light/dark |
| Shared observability | `frontend/src/components/observability/*` | PARTIAL — ChartPanel, EDT, drawers |
| Forms | `AppFormField.jsx` | PARTIAL — not all admin forms |
| Product copy constants | `frontend/src/constants/messages.js`, `terminology.js` | **Started** 2026-11-09 |

## 6. Test evidence (executed)

| Suite | Result | When |
| --- | --- | --- |
| Playwright telescope | **27 passed, 3 skipped, 0 failed** | 2026-11-09 `scripts/run-e2e-telescope.sh` |
| Vitest | 9 passed | 2026-11-09 |
| pytest observability slice | 11+ passed | collector, SLI, ingestion, admin logs |

## 7. Known programme blockers (not fixed in this audit wave)

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) and [../QA/MASTER_RELEASE_CHECKLIST.md](../QA/MASTER_RELEASE_CHECKLIST.md): **19 PASS / 93** rows; public internet **NOT READY**.

## 8. Inventory counts (this pass)

| Area | Count method | Approximate |
| --- | --- | --- |
| Page modules | `frontend/src/pages/*.jsx` | 40+ |
| Observability components | `components/observability/` | 25+ |
| App routers | `app/api/` tree | 15+ modules |

Detailed per-component audit: `FRONTEND_COMPONENT_AUDIT.md` (pending).
