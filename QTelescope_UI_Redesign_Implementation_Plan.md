# Q-TeleScope — UI Redesign Implementation Plan

**Sprint 0 deliverable** (verification only — no application source changes in this sprint)  
**Date:** 2026-10-31  
**Inputs:** Live repo inspection, `frontend/src/services/api.js`, FastAPI routers under `app/api/`, prior [QTelescope_Frontend_UX_UI_Audit.md](QTelescope_Frontend_UX_UI_Audit.md), screenshot inventory under `audit/frontend-screenshots/2026-10-31/`.

**Approval gate:** Do **not** start Sprint 1 until this plan is reviewed.

---

## 1. Current verified architecture

### 1.1 Stack

| Layer | Technology | Location |
|-------|------------|----------|
| UI | React 18 + Vite | `frontend/` |
| Routing | React Router 6 | `frontend/src/main.jsx`, shell in `App.jsx` |
| Styling | Tailwind 4 import + global CSS variables | `frontend/src/index.css` |
| Charts | `echarts-for-react` | Telemetry/dashboard pages |
| API client | `fetch` wrapper | `frontend/src/services/api.js` |
| Auth | Bearer session + optional `REQUIRE_API_AUTH` | `app/core/sessions.py`, `app/api/auth.py` |
| Backend | FastAPI, SQLAlchemy | `app/main.py`, `app/api/*` |

### 1.2 Application bootstrap

- **`main.jsx`:** Public routes `/`, `/login`, `/register`; authenticated shell `/app/*` → `App.jsx`.
- **`App.jsx`:** If `localStorage.quantum_user` missing, renders **`LoginPage` inside `/app/*`** (compact) — distinct from marketing `/login` route.
- **`appNav.js`:** Canonical deep-link mapping for shell state ↔ `/app/...` paths.
- **Theme:** `ThemeProvider` (light/dark class on document).
- **Global honesty strip:** `DataProvenanceBar` → `GET /admin/provenance`.

### 1.3 State and refresh patterns

- **No global store** — each page owns `useState` / `useEffect`.
- **Polling examples:** Dashboard 8s; sidebar alert count 6s; Operations Centre 15s; Provenance 60s.
- **SSE:** `LiveTelemetry.jsx` → `GET /events/stream` (payload is **`database_aggregate`** refresh ticks — see `app/api/events.py`).
- **Lookback window:** `TelemetryWindowControl` + `utils/telemetryWindow.js` (localStorage hours) — used on some telemetry pages, **not** on dashboard.

### 1.4 Backend router inventory (API v1 prefix)

Routers mounted in `app/main.py`: `backends`, `topology`, `qubits`, `calibration`, `drift`, `queues`, `jobs`, `health`, `alerts`, `admin`, `reports`, `events`, `auth`, `environment`, `incidents`, `operations`, `evidence`, `metrics`, `infra`, `federated`, `anomalies`, `replay`, `research`.

Frontend `api.js` covers most of these; gaps noted in §5.

---

## 2. Route inventory (verified)

### 2.1 Public

| URL | Component | Notes |
|-----|-----------|--------|
| `/` | `LandingPage.jsx` | Marketing |
| `/login` | `LoginPage.jsx` + marketing chrome | Captcha required |
| `/register` | `RegisterPage.jsx` | Captcha; Admin role blocked server-side |

### 2.2 Authenticated shell (`/app/*`)

| URL | Shell topic | Sub-view / page component |
|-----|-------------|---------------------------|
| `/app` | home | `DashboardHome.jsx` |
| `/app/operations` | operations | `OperationsCentre.jsx` |
| `/app/operations/health` | operations | `PlatformHealth.jsx` |
| `/app/operations/timeline` | operations | `OpsTimeline.jsx` |
| `/app/backends/inventory` | backends | `BackendInventory.jsx` |
| `/app/backends/qubits` | backends | `QubitMonitoring.jsx` |
| `/app/backends/details/:id` | backends | `BackendDetails.jsx` |
| `/app/telemetry/live` | telemetry | `LiveTelemetry.jsx` |
| `/app/telemetry/calibration` | telemetry | `CalibrationStatus.jsx` |
| `/app/telemetry/drift` | telemetry | `DriftAnalysis.jsx` |
| `/app/telemetry/trends` | telemetry | `HistoricalTrends.jsx` |
| `/app/telemetry/topology` | telemetry | `TopologyExplorer.jsx` |
| `/app/telemetry/cal-timeline` | telemetry | `CalibrationTimeline.jsx` |
| `/app/telemetry/compare` | telemetry | `BackendComparison.jsx` |
| `/app/telemetry/anomalies` | telemetry | `AnomalyMonitor.jsx` |
| `/app/telemetry/replay` | telemetry | `TemporalReplay.jsx` |
| `/app/telemetry/metrics` | telemetry | `MetricsCoverage.jsx` |
| `/app/execution/jobs` | execution | `JobMonitoring.jsx` |
| `/app/execution/queues` | execution | `QueueMonitoring.jsx` |
| `/app/resources/health` | resources | `ResourceHealth.jsx` |
| `/app/resources/environment` | resources | `EnvironmentPage.jsx` |
| `/app/resources/metrics` | resources | **`MetricsCoverage.jsx` (duplicate)** |
| `/app/alerts` | alerts | `AlertsEvents.jsx` (alerts mode) |
| `/app/alerts/incidents` | alerts | `AlertsEvents.jsx` (incidents mode) |
| `/app/reports` | reports | `ReportsPage.jsx` |
| `/app/admin` | admin | `AdministrationPage.jsx` (Admin role) |

### 2.3 URL vs UI state gaps

- **`BackendDetails.jsx`:** Internal tabs (`overview`, qubits, etc.) are **not** in URL — deep link lands on default tab only.
- **Telemetry 10 tabs:** All in URL via `telemetrySubTab` — good; long horizontal tab bar (overflow scroll in CSS).
- **`parseAppPath`:** Legacy `/app/resources/alerts` redirects topic to alerts — edge case only.

### 2.4 Runtime verification (2026-10-31)

- Playwright full-page captures for all rows above (admin session injected). See `audit/frontend-screenshots/2026-10-31/INVENTORY.md`.
- Backend pytest: **84 passed** (`USE_ALEMBIC=false PYTHONPATH=. pytest tests/`) at plan time.

---

## 3. Shared component inventory

### 3.1 Existing — reuse/extend

| Component / hook | Path | Role |
|------------------|------|------|
| `DataProvenanceBar` | `components/DataProvenanceBar.jsx` | Platform data mode strip |
| `TelemetryWindowControl` | `components/TelemetryWindowControl.jsx` | Lookback select (localStorage) |
| `BoneyardSkeleton` | `components/ui/Skeleton.jsx` | Loading layouts |
| `ThemeProvider` | `components/ui/ThemeProvider.jsx` | Light/dark |
| `Button` | `components/ui/Button.jsx` | Marketing + some forms |
| `CaptchaField` | `components/CaptchaField.jsx` | Auth |
| `AuthShell` | `components/AuthShell.jsx` | Auth layout wrapper |
| `useTableKit` | `hooks/useTableKit.js` | Sort + pagination |
| `formatIST` / `formatISTTime` | `utils/time.js` | Timestamps |
| `readTelemetryWindowHours` | `utils/telemetryWindow.js` | Shared lookback |
| Marketing header/footer | `components/marketing/*` | Public pages only |

### 3.2 Duplication / inconsistency

| Issue | Evidence |
|-------|----------|
| **MetricsCoverage** mounted twice | `/app/telemetry/metrics` and `/app/resources/metrics` |
| **ECharts theme/tooltip** duplicated | Per-page options; some hardcode light tooltip colors (`HistoricalTrends.jsx`) |
| **Empty states** | Ad-hoc divs per page — no shared `EmptyState` / `ErrorState` |
| **KPI card pattern** | Copy-pasted `.grid-summary` + `.card` on Dashboard, Operations, Platform Health, Alerts stats |
| **Native `title=` tooltips** | Sparse, not keyboard-accessible |
| **`api.js` duplicate key** | `getFederationStatus` defined twice (lines ~153–155) — harmless JS override but should clean in a later sprint |
| **Admin mock path copy** | UI references `backend/app/core/mock_data.py` — stale vs canonical `app/` |

### 3.3 Missing (Sprint 1 targets — do not build in Sprint 0)

`PageHeader`, `InfoTooltip`/`GlossaryPopover`, `DataSourceBadge`, `ChartPanel`, extended `TimeRangeSelector`, `DetailDrawer`, shared `EmptyState`/`ErrorState`, density mode class, chart theme helper.

---

## 4. Page-by-page implementation map

Legend: **API** = primary endpoints; **Derived** = client-side from list payloads; **Gap** = UI must not fake.

| Sprint | Page | File(s) | Primary APIs | Polling/SSE | Notes |
|--------|------|---------|--------------|-------------|-------|
| 2 | Dashboard | `DashboardHome.jsx`, `.css` | `/admin/summary`, `/backends`, `/alerts`, `/jobs`, `/queues`, `/calibration`, `/health/coherence`, `/auth/config-status` | 8s poll | Single 180px chart; table duplicates inventory |
| 3 | Operations Centre | `OperationsCentre.jsx` | `/operations/centre`, `/federated/summary`, `/federated/identity` | 15s | Incidents list capped at 10 in API |
| 3 | Platform Health | `PlatformHealth.jsx` | `/operations/platform-health` | on load | Overlaps admin collector data |
| 3 | Resource Health | `ResourceHealth.jsx` | `/health/vector`, `/health/modules`, `/health/explain/{backend}`, quarantine POSTs | on load | Module strip = API `GET /health/modules` |
| 4 | Backend Inventory | `BackendInventory.jsx`, `.css` | `/backends` | on load | `useTableKit` |
| 4 | Backend Details | `BackendDetails.jsx`, `.css` | `/backends/{id}`, status, qubits, cal, connectivity, jobs, queue, optional `/infra/classical/{id}` | on load | Many internal tabs |
| 4 | Qubit Monitoring | `QubitMonitoring.jsx`, `.css` | `/backends`, per-backend qubits | on load | No virtualization today |
| 4 | Backend Comparison | `BackendComparison.jsx` | `POST /health/compare` | on action | Modality guards server-side |
| 5 | Live Telemetry | `LiveTelemetry.jsx` | SSE `/events/stream` | SSE | Rich metadata in SSE JSON already |
| 5 | Calibration Status | `CalibrationStatus.jsx`, `.css` | `/calibration` | on load | |
| 5 | Drift Analysis | `DriftAnalysis.jsx`, `.css` | `/drift`, `/drift/{id}`, qubit drift | window + load | Uses telemetry window |
| 5 | Historical Trends | `HistoricalTrends.jsx`, `.css` | qubit/backend history endpoints | on load | Dark tooltip bug |
| 5 | Calibration Timeline | `CalibrationTimeline.jsx` | `/calibration/{id}/timeline` | on load | |
| 6 | Topology Explorer | `TopologyExplorer.jsx` | `/backends/{id}/topology` | on load | |
| 6 | Anomaly Monitor | `AnomalyMonitor.jsx` | `/anomalies/summary`, per-qubit | on load | |
| 6 | Temporal Replay | `TemporalReplay.jsx` | `/replay/{id}/timeline`, `/frame/{i}` | on load | |
| 6 | Job Monitoring | `JobMonitoring.jsx`, `.css` | `/jobs`, `/jobs/analytics/failures` | on load | Filters + table kit |
| 6 | Queue Monitoring | `QueueMonitoring.jsx`, `.css` | `/queues`, **`/queues/analytics/summary`** (unused in UI today) | on load | History: `/queues/{id}/history` |
| 7 | Environment | `EnvironmentPage.jsx` | `/environment/*`, ingest status | on load | NOT_BUILT MQTT honest in API |
| 7 | Metrics Coverage | `MetricsCoverage.jsx` | `/metrics/registry`, `/metrics/coverage`, `/metrics/capabilities` | on load | Dedupe nav in Sprint 7 |
| 7 | Alerts / Incidents | `AlertsEvents.jsx`, `.css` | `/alerts`, `/incidents`, incident POST transitions | on load | No **assign** API |
| 7 | Reports | `ReportsPage.jsx`, `.css` | `/reports/bundle`, export URLs, `/evidence/snapshots*` | on load | Manifest via evidence API |
| 8 | Administration | `AdministrationPage.jsx`, `.css` | `/admin/*` | mixed | Modal focus trap deferred |
| 8 | Ops Timeline | `OpsTimeline.jsx` | `/operations/timeline` | on load | |
| 8 | Login / Register | `LoginPage.jsx`, `RegisterPage.jsx` | `/auth/*` | — | Captcha mandatory |
| 1 | Shell | `App.jsx`, `index.css` | `/alerts?status=ACTIVE`, `/admin/provenance` | 6s / 60s | Sidebar badge = total active count |

---

## 5. API / data dependency summary

### 5.1 Dashboard layout C (technical) — **available now**

| Widget | Endpoint | Fields |
|--------|----------|--------|
| Provenance | `GET /admin/provenance` | `platform_data_mode`, `latest_backend_telemetry`, `enable_mock_data` |
| Collector health | `GET /admin/collector-health` | provider status |
| DLQ | `GET /admin/collector-dlq` | recent failures |
| Adapter verify | `GET /admin/adapters/verification` | per-adapter |
| Platform health | `GET /operations/platform-health` | DB, SSE kind, circuit breakers |
| Metric coverage | `GET /metrics/coverage` | gaps |

### 5.2 Dashboard layout A (operations) — **mostly available**

| Widget | Endpoint | Gap |
|--------|----------|-----|
| Critical alerts | `GET /alerts?status=ACTIVE&severity=CRITICAL` | Default limit 100 — OK; need client grouping |
| Open incidents | `GET /incidents?status=...` or ops centre payload | Ops centre returns max 10 incidents |
| RED health | `GET /health/vector` | Derive counts from `backends[].counts.RED` |
| Collector failures | `GET /operations/centre` → `collectors.failed_or_stale` | OK |
| DLQ count | `GET /operations/platform-health` → `collectors.dlq_recent_count` | OK |
| Queue pressure | `GET /queues`, `/calibration` | OK |
| Recent changes | `GET /operations/timeline` | OK |

### 5.3 Dashboard layout B (fleet intelligence) — **partial**

| Widget | Status |
|--------|--------|
| Fleet composition | **Now** — `/backends` modality/provider counts |
| T1/T2 by backend | **Now** — `/health/coherence` |
| Calibration freshness distribution | **Now** — `/calibration` list |
| Backend compare shortcut | **Now** — navigate to compare with query state (may need URL params — optional) |
| **Fleet availability over time** | **Gap** — no fleet-wide time series; per-backend `/backends/{id}/telemetry` history exists but requires N calls or new aggregation |
| **Job utilization trend over time** | **Gap** — `/jobs` is snapshot list; no `/jobs/history` rollup |
| Sparklines on KPIs | **Gap** unless historical series endpoint added or derived from stored telemetry samples |

### 5.4 Resource Health module table

`GET /health/modules` returns: `id`, `name`, `status` (`LIVE` | `STUB` | `NOT_BUILT`) — **no** `last_evaluation` timestamp. UI must show “—” or omit column until API extended (do not invent).

### 5.5 Incidents workflow

Supported transitions (server): `acknowledge`, `investigate`, `resolve`, `comments`. **No assignee API** — Sprint 7 UI must not show assignment persistence without backend.

### 5.6 Federation

`GET /federated/summary`, `/identity`, `/status` — local snapshot / import model; UI must label **not live national mesh** (per IMP-P6 docs).

### 5.7 Queue wait distribution

`GET /queues/analytics/summary` provides per-backend mean/max wait and pending from **stored telemetry samples** — suitable for histogram/bar with honesty note (already in API `note`). **Not wired in `QueueMonitoring.jsx` today.**

### 5.8 Time range behavior

| Control | Affects API? |
|---------|----------------|
| `TelemetryWindowControl` | Pages that pass hours into drift/timeline queries — **page-specific** |
| Dashboard | **No** time range today — adding one requires wiring only endpoints that accept time/window (many list endpoints are **latest snapshot only**) |

---

## 6. Proposed design system (Sprint 1 blueprint)

### 6.1 Visual direction

Scientific infrastructure console: neutral surfaces, severity-colored accents, compact tables, charts sized to analytical role, minimal decorative icons. **Not** Grafana clone.

### 6.2 CSS architecture

- Extend **`index.css`** tokens: `--density-compact`, `--panel-gap`, `--chart-min-height`, semantic `--status-live`, etc.
- Add **`frontend/src/components/observability/`** (or `components/console/`) for new shared pieces — avoid scattering inline styles in new work.
- **Chart theme helper:** single module consumed by all `ReactECharts` options (dark/light tooltip, splitLine colors) — replaces per-file duplication.

### 6.3 Data honesty labels

Map backend truth to `DataSourceBadge`:

| Label | Typical source |
|-------|----------------|
| Live | Vendor or live collector path |
| Simulated | `ENABLE_MOCK_DATA`, mock catalog |
| Mock catalog | `MOCK_BACKEND_IDS` / demo QPUs |
| Cached | DB snapshot / SSE aggregate tick |
| Stale | `staleness_seconds` from SSE or old `source_timestamp` |
| Partial | Sparse history (queue analytics note pattern) |
| Unsupported | Metric not in registry for provider |
| Unknown | Missing fields |
| Error | Collector DLQ / failed provider |
| NOT_BUILT | e.g. MQTT adapter, router hysteresis |

### 6.4 Density modes

- **Comfortable** (default): current spacing baseline.
- **Compact:** `.page-container--compact` — tighter table padding, smaller card padding, more rows visible.
- **Persist:** `localStorage` keys e.g. `qtelescope_density`, `qtelescope_dashboard_layout` — **no DB user prefs without explicit approval** (P4 has `user_accounts` but no preference schema yet).

### 6.5 Accessibility baseline

- WCAG 2.2 AA targets: focus, headings, tooltips, modals, chart text alternatives.
- Do not claim compliance until Sprint 9 axe + manual pass.

---

## 7. Sprint sequence (aligned with prompt pack)

| Sprint | Scope | Depends on |
|--------|-------|------------|
| **0** | This plan | — |
| **1** | Design system + shell (`PageHeader`, tooltips, badges, `ChartPanel`, density, shell breadcrumbs, alert badge severity) | Sprint 0 approval |
| **2** | `DashboardHome` — layouts A/B/C, widget registry, honest empty states | Sprint 1 components |
| **3** | Operations Centre, Platform Health, Resource Health | Sprint 1 |
| **4** | Inventory, Details, Qubits, Comparison | Sprint 1 |
| **5** | Live telemetry + calibration/drift/trends/timeline | Sprint 1 chart helper |
| **6** | Topology, anomalies, replay, jobs, queues (+ wire queue analytics) | Sprint 1 |
| **7** | Environment, metrics (dedupe nav), alerts/incidents, reports | Sprint 1 drawers |
| **8** | Admin, ops timeline, auth compact, responsive sidebar | Sprint 1 |
| **9** | axe, perf, regression, completion report | All |

**Stop rule:** After each sprint, produce the required 9-point sprint report and **wait for review** — do not chain sprints without approval.

---

## 8. Risk register

| ID | Area | Risk | Mitigation |
|----|------|------|------------|
| R-01 | Navigation | Breaking `/app/*` deep links | Only extend `appNav.js`; run existing route tests + manual URL checklist |
| R-02 | Auth | Session + captcha regressions | Do not change auth contract in UI sprints; test login/register manually |
| R-03 | Health / quarantine | Misleading “scheduler exclusion” copy | Keep advisory language; link to help drawer |
| R-04 | Provider truth | Mis-label LIVE vs MOCK | Use admin credentials truth + `DataSourceBadge`; no new LIVE labels without API |
| R-05 | SSE | UI implies vendor live stream | Always show `stream_kind` + `message` from SSE payload |
| R-06 | Alerts | 100+ rows performance | Virtualization in Sprint 7; severity filters via existing API params |
| R-07 | Dashboard | Fabricated trends | Use §9 data gaps; empty/unsupported widgets |
| R-08 | Incidents | Frontend-only assign | Omit assign until API exists |
| R-09 | Reports / evidence | Export claims | Preview from `/evidence/snapshots/{id}/manifest` where available |
| R-10 | RBAC | Mutations without role | Preserve Bearer + `X-User-Role`; test with Operator vs Admin |
| R-11 | CSS refactor | Dark mode regressions | Shared chart theme + token-only colors in touched files |
| R-12 | Dependencies | Scope creep | No new chart library; ECharts only unless approved |

---

## 9. Explicit data gaps (do not fake in UI)

Features **blocked or partial** until backend or stored history exists:

1. **Fleet-wide availability time series** (single chart) — no `/fleet/availability/history`; workaround: multi-fetch per backend telemetry history with loading cap + honesty, or defer widget.
2. **Dashboard KPI sparklines** — no summary history endpoints.
3. **Job outcome rate over time** — no aggregated `/jobs/timeseries`.
4. **Health module `last_evaluation`** — not in `/health/modules` response.
5. **Incident assignment** — no API field/workflow.
6. **Custom global time range on dashboard** — most dashboard endpoints are point-in-time lists; only widget-specific history APIs accept limits/windows.
7. **Geographic fleet map** — no site/geo fields in standard backend model for map split.
8. **True vendor-live SSE** — implementation is DB aggregate refresh (`stream_kind: database_aggregate`).
9. **Router hysteresis / live cryo adapter** — API marks `NOT_BUILT`; UI = disabled + help, not fake live.
10. **User dashboard layout in DB** — requires schema/product decision; MVP = localStorage only.

For each gap, Sprint 2+ must use **`ChartPanel` empty/unsupported states** with short explanation and link to admin/platform health where relevant.

---

## 10. Testing strategy

| Layer | Current | Redesign gate |
|-------|---------|---------------|
| Backend | 84 pytest | Run full suite after each sprint touching shared contracts |
| Frontend unit | None | Optional minimal tests for `InfoTooltip`, `appNav` — only if added in Sprint 1 |
| E2E | None | Sprint 9: Playwright smoke (login optional captcha bypass in test env only) |
| Visual | Screenshot folder 2026-10-31 | Before/after per sprint in completion report |
| a11y | Not automated | Sprint 9 axe on Dashboard, Login, Operations, Resource Health |
| Manual | — | Checklist per sprint: deep links, dark mode, density toggle, no console API 401 regressions |

**Commands (baseline):**

```bash
USE_ALEMBIC=false PYTHONPATH=. pytest tests/
cd frontend && npm run build
```

---

## 11. High-risk change zones (touch carefully)

1. **`App.jsx` / `appNav.js`** — routing and shell.
2. **`ResourceHealth.jsx` + `/health/*` actions** — quarantine is local DB advisory.
3. **`AlertsEvents.jsx` + incident POST handlers** — RBAC when `ENFORCE_RBAC=true`.
4. **`AdministrationPage.jsx`** — credentials, retention, rules delete.
5. **`ReportsPage.jsx` / evidence download** — auth headers on blob download.
6. **`LiveTelemetry.jsx` SSE URL** — token query param must remain for auth middleware.

---

## 12. Sprint 1 file touch list (preview — after approval)

| Action | Paths |
|--------|-------|
| Add | `frontend/src/components/observability/PageHeader.jsx`, `InfoTooltip.jsx`, `DataSourceBadge.jsx`, `ChartPanel.jsx`, `EmptyState.jsx`, `ErrorState.jsx`, `DetailDrawer.jsx`, `chartTheme.js` |
| Extend | `TelemetryWindowControl.jsx` → document which pages honor lookback |
| Modify | `App.jsx`, `index.css`, possibly `appNav.js` (breadcrumb labels only) |
| Do not yet | Page-level rewrites (Sprint 2+) |

---

## 13. References

- UX audit: [QTelescope_Frontend_UX_UI_Audit.md](QTelescope_Frontend_UX_UI_Audit.md)
- Page matrix: [QTelescope_Page_and_Feature_Matrix.md](QTelescope_Page_and_Feature_Matrix.md)
- Security / honesty: [docs/SECURITY.md](docs/SECURITY.md)
- IMP worklog: [.planning/qtelescope-national/WORKLOG.md](.planning/qtelescope-national/WORKLOG.md)

---

## 14. Sprint status

| Sprint | Status | Report |
|--------|--------|--------|
| 0 | Complete | This document |
| 1 | Complete | [QTelescope_UI_Redesign_Sprint1_Report.md](QTelescope_UI_Redesign_Sprint1_Report.md) |
| 2 | Complete | [QTelescope_UI_Redesign_Sprint2_Report.md](QTelescope_UI_Redesign_Sprint2_Report.md) |
| 3 | Complete | [QTelescope_UI_Redesign_Sprint3_Report.md](QTelescope_UI_Redesign_Sprint3_Report.md) |
| 4 | Complete | [QTelescope_UI_Redesign_Sprint4_Report.md](QTelescope_UI_Redesign_Sprint4_Report.md) |
| 5 | Complete | [QTelescope_UI_Redesign_Sprint5_Report.md](QTelescope_UI_Redesign_Sprint5_Report.md) |
| 6+ | **Awaiting review** | — |

**Next:** Sprint 6 — topology, anomalies, replay, jobs, queues.
