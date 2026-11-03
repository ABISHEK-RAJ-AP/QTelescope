# Q-TeleScope — Page-by-Page Implementation Plan

**Status:** Analysis complete — **do not implement until reviewed**  
**Re-verified:** 2026-10-31 against `frontend/src`, `app/api`, `appNav.js`, `api.js`  
**Companion docs:**  
[`QTelescope_Page_Data_Source_Matrix.md`](QTelescope_Page_Data_Source_Matrix.md) ·  
[`QTelescope_Route_and_Context_Map.md`](QTelescope_Route_and_Context_Map.md) ·  
[`QTelescope_Shared_Component_Plan.md`](QTelescope_Shared_Component_Plan.md) ·  
[`QTelescope_Prioritized_Implementation_Roadmap.md`](QTelescope_Prioritized_Implementation_Roadmap.md) ·  
[`QTelescope_Open_Questions_and_Verification_Gaps.md`](QTelescope_Open_Questions_and_Verification_Gaps.md)

---

## 0. Repository snapshot (verified)

| Layer | Finding |
| ----- | ------- |
| FE | React 19 + Vite 8 + React Router 7; shell in `App.jsx`; 27 page components under `frontend/src/pages/` |
| Routing | Public `/`, `/login`, `/register`; app `/app/*` with state in `appNav.js` (not every sub-tab in all URLs) |
| BE | FastAPI routers in `app/main.py` — backends, health, operations, alerts, incidents, replay, anomalies, etc. |
| Auth | Bearer + `X-User-Role`; admin-only Configure nav |
| Tests | `tests/` pytest suite exists; frontend `npm run build`, `npm run lint` (oxlint) |
| Trust | `app/providers/truth.py`, `getProvenance`, `ENABLE_MOCK_DATA`, adapter verification API |

---

## 1. Current page and route inventory

| # | Page | Component | Current route | Nav today |
| - | ---- | --------- | ------------- | --------- |
| 1 | Landing | LandingPage.jsx | `/` | Public |
| 2 | Login | LoginPage.jsx | `/login` | Public |
| 3 | Register | RegisterPage.jsx | `/register` | Public |
| 4 | Dashboard | DashboardHome.jsx | `/app` | Observe › Dashboard |
| 5 | Operations Centre | OperationsCentre.jsx | `/app/operations` | Observe › Operations › Centre |
| 6 | Platform Health | PlatformHealth.jsx | `/app/operations/health` | Operations tab |
| 7 | Ops Timeline | OpsTimeline.jsx | `/app/operations/timeline` | Operations tab |
| 8 | Backend Inventory | BackendInventory.jsx | `/app/backends/inventory` | Backends tab |
| 9 | Qubit Monitoring | QubitMonitoring.jsx | `/app/backends/qubits` | Backends tab |
| 10 | Backend Details | BackendDetails.jsx | `/app/backends/details/{id}` | Backends tab |
| 11–20 | Telemetry suite | LiveTelemetry, CalibrationStatus, DriftAnalysis, HistoricalTrends, TopologyExplorer, CalibrationTimeline, BackendComparison, AnomalyMonitor, TemporalReplay, MetricsCoverage | `/app/telemetry/{sub}` | Telemetry tabs (10) |
| 21 | Job Monitoring | JobMonitoring.jsx | `/app/execution/jobs` | Execution |
| 22 | Queue Monitoring | QueueMonitoring.jsx | `/app/execution/queues` | Execution |
| 23 | Resource Health | ResourceHealth.jsx | `/app/resources/health` | Resources |
| 24 | Environment | EnvironmentPage.jsx | `/app/resources/environment` | Resources |
| 25 | Metrics Coverage (dup) | MetricsCoverage.jsx | `/app/resources/metrics` | Resources |
| 26 | Alerts | AlertsEvents.jsx | `/app/alerts` | Record |
| 27 | Incidents | AlertsEvents.jsx | `/app/alerts/incidents` | Record |
| 28 | Reports | ReportsPage.jsx | `/app/reports` | Record |
| 29 | Administration | AdministrationPage.jsx | `/app/admin` | Configure |

---

## 2. Cross-cutting implementation rules

1. **Classify every metric** before display (see Data Source Matrix).  
2. **No stub/mock as live hardware.** Use `ProvenanceChip` + configure links.  
3. **Preserve investigation context** via URL (`Route and Context Map`).  
4. **Legacy redirects** for all renamed routes.  
5. **Phased PRs** per Roadmap — P0 before P1 charts.  
6. **Acceptance tests:** manual workflow scripts + `npm run build`; backend pytest when API touched.

---

## 3. Page-by-page plan (purpose → implementation)

Each section: **Purpose · Primary user · Main question · Primary action · Layout · APIs · Trust · States · Navigation · Acceptance**

---

### 3.1 Fleet Overview (`/app/overview`, today `/app`)

| | |
| --- | --- |
| **Purpose** | Concise fleet health + prioritized exceptions — not full ops workspace |
| **Primary user** | Leadership, operator |
| **Main question** | Is the fleet healthy; what needs attention? |
| **Primary action** | Open exception target (alert, incident, backend, platform) |
| **Current behavior** | 14 API calls; widgets: exceptions, modality, coherence chart, alerts list, fleet table, ops timeline, etc. (`DashboardHome.jsx`) |
| **Proposed layout** | (1) Header + last refresh (2) Fleet status summary (3) ExceptionStrip — **critical** not equal to sidebar total (4) 1–2 charts max (5) Recent events ≤5 (6) Backend cards → workspace — **remove** full inventory table |
| **APIs** | Keep: `getAlerts(ACTIVE)`, `getOperationsCentre`, `getCoherence`, `getPlatformHealth`, `getHealthVector` (RED sum), `getOpsTimeline(5)`; drop or lazy-load: duplicate full `getBackends` table widget |
| **Trust** | Show `platform_data_mode` from provenance in header hint when mock/mixed |
| **States** | Empty fleet → panel; partial API fail → per-widget error not whole page |
| **Navigation** | Each exception deep-links per investigation chain |
| **Acceptance** | No unexplained critical vs active mismatch; no mock as live |
| **Priority** | P0 |

---

### 3.2 Operator Console (`/app/operate`, today `/app/operations`)

| | |
| --- | --- |
| **Purpose** | Operational **work queue** |
| **Primary user** | Incident responder, platform operator |
| **Main question** | What must I act on now? |
| **Primary action** | Open incident / alert / collector / backend |
| **Current behavior** | Duplicates exception strip; mixes federated panel, collector tables, timeline (`OperationsCentre.jsx`) |
| **Proposed layout** | (1) Ops status one-liner (2) Incidents table top (3) Critical/high alerts (4) Collector failures (5) Freshness gaps (6) Timeline excerpt (7) Quick links |
| **APIs** | `getOperationsCentre`, `getAlerts(ACTIVE)`, `getOpsTimeline`; federated optional collapsible |
| **Trust** | Label **Active alerts (all severities)** vs **Critical** explicitly |
| **States** | Distinguish healthy empty vs load failure |
| **Navigation** | Alert → `/app/record/alerts?alertId=`; incident → incidents; collector → configure/collectors |
| **Acceptance** | Urgent issue → investigation ≤2 clicks; counts match matrix definitions |
| **Priority** | P0 |

---

### 3.3 Backend Registry (`/app/fleet`, today inventory)

| | |
| --- | --- |
| **Purpose** | Searchable fleet inventory |
| **Primary user** | Operator, engineer |
| **Main question** | Which backends exist and are they reachable/fresh? |
| **Primary action** | Open Backend Workspace |
| **Current** | Table + filters; queues merged for pending (`BackendInventory.jsx`) |
| **Proposed layout** | FleetSummaryBand → filters → table → row actions |
| **Table fields** | Name, id, provider, modality, qubit count, operational status, **last telemetry** (from backend status/telemetry if available), pending jobs, adapter status (`getAdapterVerification` P1), alerts count optional P2 |
| **APIs** | `getBackends`, `getQueues` |
| **Trust** | Distinguish registered vs telemetry-fresh vs credentials-only |
| **Acceptance** | Row → workspace; stale not shown as healthy |
| **Priority** | P1 |

---

### 3.4 Backend Workspace (`/app/fleet/{backendId}/{tab}`)

| | |
| --- | --- |
| **Purpose** | Single-backend operational hub |
| **Primary user** | Engineer, operator |
| **Main question** | What is happening on this backend? |
| **Primary action** | Tab-specific drill (telemetry, qubit, job) |
| **Current** | `BackendDetails.jsx` — 5 internal tabs, URL only has id |
| **Tabs** | summary \| telemetry \| qubits \| calibration \| jobs \| queues \| health \| topology |
| **Summary tab** | Status, freshness, active alerts (filter backend), recent jobs, cal snapshot, events, links |
| **APIs** | Existing detail/status/qubits/cal/jobs/queue/connectivity/topology endpoints |
| **Trust** | Modality-aware panels; hide N/A metrics |
| **Acceptance** | URL share restores tab; time range preserved in query |
| **Priority** | P0–P1 |

---

### 3.5 Qubit Health

| | |
| --- | --- |
| **Purpose** | Localized degradation |
| **Consolidation** | Primary: workspace **qubits** tab; optional fleet-wide `/app/fleet/qubits` for cross-backend search |
| **Layout** | ContextBar → summary → table/grid → detail chart + history |
| **APIs** | `getBackendQubits`, `getQubitHistory` |
| **URL** | `qubitId` query param |
| **Acceptance** | Metric units + last update; missing ≠ failed |
| **Priority** | P1 |

---

### 3.6 Live Telemetry (`/app/analyze/live`)

| | |
| --- | --- |
| **Purpose** | Recent platform refresh stream — **not vendor push** |
| **Current** | SSE `GET /events/stream` (`LiveTelemetry.jsx`) |
| **Layout** | Connection banner → optional backend filter → metric/chart → event log |
| **Trust** | State: connected / disconnected / stale; show event timestamp age |
| **Acceptance** | User knows live vs delayed; no fake continuous stream |
| **Priority** | P1 |

---

### 3.7 Calibration Status vs Timeline

| | |
| --- | --- |
| **Status** | `/app/analyze/calibration` — snapshot fleet table (`CalibrationStatus.jsx`) |
| **Timeline** | `/app/analyze/calibration/timeline` — events + chart (`CalibrationTimeline.jsx`) |
| **Rule** | Never conflate snapshot vs historical series labels |
| **APIs** | `getBackendCalibration`, `getCalibrationTimeline` |
| **Priority** | P1 |

---

### 3.8 Drift Analysis (`/app/analyze/drift`)

| | |
| --- | --- |
| **Purpose** | Metric change vs baseline |
| **APIs** | Drift endpoints in `api.js` |
| **UI** | Selectors → summary → chart → link qubits/cal/alerts |
| **Trust** | “Advisory detection” — not confirmed hardware fault |
| **Priority** | P1–P2 |

---

### 3.9 Trends (`/app/analyze/trends`)

| | |
| --- | --- |
| **Purpose** | Long-window patterns |
| **API** | `getBackendTelemetry` |
| **UI** | Retention hint; gap-visible charts |
| **Priority** | P1 |

---

### 3.10 Compare (`/app/analyze/compare`)

| | |
| --- | --- |
| **Purpose** | Eligible backend comparison only |
| **API** | `POST /health/compare` |
| **UI** | Eligibility explainer before results |
| **Priority** | P1 |

---

### 3.11 Topology (`/app/analyze/topology`)

| | |
| --- | --- |
| **Purpose** | Coupling structure |
| **API** | `getBackendTopology` |
| **UI** | 2D graph + **EdgeTable** (P2) |
| **Priority** | P2 |

---

### 3.12 Anomalies (`/app/investigate/anomalies`)

| | |
| --- | --- |
| **Purpose** | EWMA / changepoint hits |
| **API** | `getAnomalySummary` |
| **UI** | Filters → table → drill workspace |
| **Priority** | P1 |

---

### 3.13 Telemetry Replay (`/app/investigate/replay`)

| | |
| --- | --- |
| **Purpose** | **Stored telemetry replay** |
| **API** | `getReplayTimeline` |
| **Copy** | Required: not vendor hardware rewind |
| **Priority** | P2 |

---

### 3.14 Metrics Coverage (`/app/analyze/coverage`)

| | |
| --- | --- |
| **Purpose** | Metric availability matrix |
| **Action** | **Remove** duplicate `/app/resources/metrics` |
| **APIs** | metrics registry/capabilities/coverage |
| **Priority** | P0 |

---

### 3.15 Jobs (`/app/execute/jobs`)

| | |
| --- | --- |
| **Purpose** | Monitor job records — **not submission** |
| **APIs** | `getJobs`, `getJobFailureAnalytics` |
| **UI** | Status glossary; failure denominator fix review |
| **Priority** | P1 |

---

### 3.16 Queues (`/app/execute/queues`)

| | |
| --- | --- |
| **Purpose** | Queue depth and wait |
| **APIs** | `getQueues`, `getQueueAnalytics` |
| **UI** | Analytics table verified; histogram P2 if schema allows |
| **Priority** | P1 |

---

### 3.17 Resource Health (`/app/resources/health`)

| | |
| --- | --- |
| **Purpose** | Advisory health vector + local quarantine |
| **APIs** | health vector, modules, explain, quarantine POSTs |
| **UI** | Action bar → legend → backend accordions → reference fold (modules/formula) |
| **Trust** | **Advisory** quarantine — not IBM/IonQ/Rigetti enforcement |
| **Priority** | P0–P1 (hierarchy largely aligned; polish labels) |

---

### 3.18 Environment (`/app/resources/environment`)

| | |
| --- | --- |
| **Purpose** | Imported / facility data |
| **APIs** | environment import/export/ingest |
| **UI** | Source banner; NOT_BUILT for live cryo/RF |
| **Priority** | P1 |

---

### 3.19 Alerts (`/app/record/alerts`)

| | |
| --- | --- |
| **Purpose** | Canonical alert list |
| **Fix** | Default `status=ACTIVE`; align with sidebar definition |
| **APIs** | `getAlerts`, acknowledge, resolve |
| **Links** | Incident, timeline, workspace |
| **Priority** | P0 |

---

### 3.20 Incidents (`/app/record/incidents`)

| | |
| --- | --- |
| **Purpose** | Coordination workflow |
| **APIs** | incidents + workflow POSTs |
| **UI** | Related alerts; timeline |
| **Priority** | P1 |

---

### 3.21 Operations Timeline (`/app/investigate/timeline`)

| | |
| --- | --- |
| **Purpose** | Chronological correlation |
| **API** | `getOpsTimeline` |
| **UI** | Scope + time in URL |
| **Priority** | P1 |

---

### 3.22 Reports & Evidence (`/app/record/reports`)

| | |
| --- | --- |
| **Purpose** | Exports + snapshots |
| **APIs** | reports export, evidence snapshots, bundle |
| **UI** | Manifest preview P2; demote “ask assistant” visually |
| **Priority** | P2 |

---

### 3.23 Platform Health (`/app/platform/health`)

| | |
| --- | --- |
| **Purpose** | Q-TeleScope platform — **not QPU health** |
| **API** | `getPlatformHealth` |
| **Nav** | Move out of Operations tabs |
| **Priority** | P0 |

---

### 3.24–3.27 Configure (split Admin)

| Page | Route | Extract from AdministrationPage |
| ---- | ----- | ------------------------------ |
| Integrations | `/app/configure/integrations` | Credentials, discovery, adapter verification |
| Collectors | `/app/configure/collectors` | Schedules, DLQ, collector health |
| Alert Rules | `/app/configure/rules` | Rules CRUD + modal |
| Platform Settings | `/app/configure/platform` | Config/mock strip, deployment profile |

**Priority:** P0 split start, P1 complete + DLQ UI

---

## 4. Shared product improvements (implementation order)

1. **ContextBar** + URL params (P1)  
2. **ExceptionStrip** + alert glossary (P0)  
3. **ProvenanceChip** + stale/partial states (P0)  
4. **WorkspaceTabNav** (P1)  
5. **Design token cleanup** — remove page inline colors (P1)  
6. **WCAG** — topology table alt, focus rings (P2)

See [`QTelescope_Shared_Component_Plan.md`](QTelescope_Shared_Component_Plan.md).

---

## 5. Navigation and context preservation

- Implement [`QTelescope_Route_and_Context_Map.md`](QTelescope_Route_and_Context_Map.md) redirects in Sprint A–C.  
- Extend `pageContext.js` titles to include backend name (fetch from registry cache).  
- Investigation chain: Alert → Timeline → Workspace → Evidence.

---

## 6. Prioritized sequence

Execute [`QTelescope_Prioritized_Implementation_Roadmap.md`](QTelescope_Prioritized_Implementation_Roadmap.md): **P0 trust/IA → P1 workflows → P2 analysis → P3 optional**.

---

## 7. Risks

| Risk | Mitigation |
| ---- | ---------- |
| Breaking deep links | Redirect table + tests |
| Workspace refactor breaks BackendDetails | Phase: shell wrapper first |
| Alert count “fix” confuses users | In-app glossary + labels |
| Over-splitting Admin | Phase 1: two routes only if needed |
| Chart work without data | Gate P2 charts on API verification |

---

## 8. Unresolved questions

See [`QTelescope_Open_Questions_and_Verification_Gaps.md`](QTelescope_Open_Questions_and_Verification_Gaps.md).

---

## 9. Quality gate checklist (pre-implementation)

- [x] Every listed page reviewed against components + API grep  
- [x] Unique purpose per proposed page  
- [x] No feature assumed without API/file evidence  
- [x] Alert semantics documented  
- [x] Mock/stub/advisory called out  
- [x] Empty/error/stale addressed in plan  
- [ ] Runtime re-verification (V1–V10) — **pending**  
- [x] **No application source code modified** in this planning task  

---

## 10. Next step after review

1. Approve P0 scope (alert semantics, Operate vs Overview, metrics redirect, route redirects).  
2. Implement Sprint A as small PRs with `npm run build` + spot-check investigation chain.  
3. Re-run screenshot inventory on renamed routes.

**Stop here until explicitly authorized to implement.**
