# Q-TeleScope — Comprehensive Page-by-Page Product, Information Architecture, UX/UI, and Interaction Redesign Blueprint

**Date:** 2026-10-31  
**Scope:** Analysis and product design only — **no application source changes** in this deliverable.  
**Evidence base:** Repository inspection (`frontend/src/**`, `app/**`, `frontend/src/services/api.js`, `frontend/src/appNav.js`), existing audit [`QTelescope_Frontend_UX_UI_Audit.md`](QTelescope_Frontend_UX_UI_Audit.md), screenshot inventory [`audit/frontend-screenshots/2026-10-31/INVENTORY.md`](audit/frontend-screenshots/2026-10-31/INVENTORY.md).  
**Live re-inspection this task:** Not re-run (browser automation not executed in this session). States marked `NEEDS_VERIFICATION` where runtime-only.

---

## Section A — Executive diagnosis

### A.1 Why the product feels crowded and immature

| Finding | Type | Evidence | Label |
|---------|------|----------|-------|
| **Same KPI strip pattern everywhere** | Visual + IA | `DashboardHome.jsx`, `OperationsCentre.jsx`, `PlatformHealth.jsx` reuse `.dashboard-exception-stat` / `.page-kpi-grid` / `.grid-summary` | `VERIFIED` |
| **Dashboard aggregates 14+ API calls** into one scroll without a single “primary task” | Structural | `DashboardHome.jsx` lines ~111–124: `getSummary`, `getBackends`, `getAlerts`, `getJobs`, `getQueues`, `getCalibrations`, `getCoherence`, `getPlatformHealth`, `getHealthVector`, `getOperationsCentre`, `getOpsTimeline`, etc. | `VERIFIED` |
| **Operations Centre duplicates dashboard concepts** with potentially **different alert counts** | Structural / trust | Dashboard: `api.getAlerts('ACTIVE')`; Ops Centre: `getOperationsCentre()` **and** separate `getAlerts('ACTIVE')` — UI shows both `ops.active_alerts` and `alerts.length` (`OperationsCentre.jsx` ~79–90) | `VERIFIED` |
| **Telemetry topic hides 10 analysis modes** behind one tab row | IA | `App.jsx` + `appNav.js` `telemetrySubTab`: live, calibration, drift, trends, topology, cal-timeline, compare, anomalies, replay, metrics | `VERIFIED` |
| **Backend “Details” is a mini-app** (5 tabs) while Inventory and Qubits are sibling routes | IA | `BackendDetails.jsx` internal tabs; URL only encodes `backendId`, not active tab | `VERIFIED` |
| **Administration is one long page** mixing discovery, credentials, schedules, rules, retention | IA | `AdministrationPage.jsx` sections 1–5+ in one component | `VERIFIED` |
| **Resource Health exposes model vocabulary** before operational rows | Content hierarchy | Health vector H, module capability table — user-facing before fleet/qubit actions (`ResourceHealth.jsx`; screenshot `22-resource-health-*`) | `OBSERVED` |
| **Wide inventory table** without fleet-level visual summary | Visual + task | `BackendInventory.jsx`; screenshot `07-backend-inventory-*` | `OBSERVED` |
| **Sub-route titles weak** — shell says “Telemetry”, not “Drift · backend · window” | Navigation | `resolvePageContext` in `pageContext.js`; audit §5 | `VERIFIED` |
| **Metrics Coverage mounted twice** | Redundancy | `MetricsCoverage.jsx` at `/app/telemetry/metrics` and `/app/resources/metrics` (`INVENTORY.md` #19, #24) | `VERIFIED` |

### A.2 Visual vs structural vs data vs workflow

- **Visual:** Card/KPI sameness, badge overload, short charts in tall panels, inconsistent section alignment (partially addressed in recent CSS work — blueprint assumes **product** fix, not only tokens).
- **Structural:** Observe group mixes **overview**, **operations**, **fleet**, and **10 telemetry tools** at equal nav weight; Execute splits jobs/queues from resources/health/environment without a **backend-scoped workspace**.
- **Data:** Many charts depend on **stored telemetry density** (`QubitTelemetryModel`, `BackendTelemetryModel` — replay/drift/trends); empty charts are a **data + UX** problem, not a chart-library problem.
- **Workflow:** Incident/alert/telemetry correlation exists in API (`getOpsTimeline`, incidents API) but UI **does not carry context** (time, backend, alert id) across pages (`appNav.js` has no query params).

### A.3 Most problematic pages (priority for redesign)

1. **Dashboard** — overloaded aggregator; unclear primary outcome.  
2. **Operations Centre** — overlaps Dashboard; conflicting alert semantics.  
3. **Telemetry tab strip** — too many peer pages; no backend/time context.  
4. **Administration** — multi-role config on one scroll.  
5. **Resource Health** — advisory model vs operator action boundary unclear.  
6. **Backend Details vs Qubit Monitoring** — duplicated qubit exploration paths.

### A.4 Strengths to preserve

- **Deep linking** for main topics via `appNav.js` / `buildAppPath` (`VERIFIED`).  
- **`PageHeader` + breadcrumbs** scaffold (`PageHeader.jsx`, `pageContext.js`) (`VERIFIED`).  
- **`DataProvenanceBar` + honesty about mock/live** (`DataProvenanceBar.jsx`, `getProvenance`, `getConfigStatus`) (`VERIFIED`).  
- **Rich API surface** in `api.js` (~80 endpoints) — foundation for mature workspaces (`VERIFIED`).  
- **Health vector + explain endpoints** (`/health/vector`, `/health/explain/{backend}`) — good for progressive disclosure (`VERIFIED`).  
- **Evidence/reports** endpoints (`/evidence/snapshots`, `/reports/export`) (`VERIFIED`).  
- **Accessibility preheader** (skip link, prefs) — keep, extend to panel help pattern (`VERIFIED`).

### A.5 Mature experience target

Operators and engineers should open Q-TeleScope and immediately see **what needs attention**, **why it matters**, and **one click to the investigating workspace** — with **backend + time context** preserved. Technical model detail (H vector, module flags, adapter STUB) lives in **help layers**, not hero sections. Pages look **different because tasks differ** (queue analyst vs calibration engineer vs incident responder), not because of random card counts.

### A.6 Product-level changes (not CSS-only)

1. **Define canonical “Fleet Overview” vs “Operator Console”** — split Dashboard and Operations responsibilities.  
2. **Introduce Backend Workspace** — inventory → scoped hub (telemetry, jobs, health, topology) with shared context.  
3. **Re-home Telemetry** — group by analysis intent (Live / Calibration / Coherence / Compare / Investigate).  
4. **Split Admin** into Configure sub-routes (Integrations, Collectors, Rules, Platform).  
5. **Global context model** — URL/query for `backendId`, `from`, `to`, `metric`.  
6. **Unify exception counts** — single API field or UI rule for “active alerts”.  
7. **Workflow links** — alert → timeline slice → backend telemetry at detection time.

---

## Section B — User personas and operational workflows

### B.1 Personas (implied by UI/API)

| Persona | Evidence | Primary pages today |
|---------|----------|---------------------|
| **Facility operator** | Environment import, MQTT status admin API | Environment, Platform Health |
| **Quantum hardware engineer** | Qubit tables, topology, drift, calibration | Qubits, Topology, Drift, Calibration * |
| **Quantum researcher** | Compare, coherence, historical trends | Compare, Trends, Live Telemetry |
| **Platform / SRE** | Collector health, platform health, DLQ admin | Platform Health, Admin, Ops Timeline |
| **Calibration engineer** | Calibration timeline/status, drift | Calibration Status, Cal Timeline |
| **Incident responder** | Alerts, incidents, ops timeline | Alerts, Incidents, Ops Centre |
| **Administrator** | Credentials, schedules, rules | Admin |
| **Leadership / audit** | Reports, evidence snapshots | Reports |
| **Evidence reviewer** | Export bundle, snapshots | Reports |

Role gating: `isAdmin` for Admin nav only (`App.jsx`); alerts acknowledge uses username string (`api.acknowledgeAlert`) — **no fine-grained RBAC in FE** (`INFERRED`).

### B.2 Workflow maps

#### W1 — Degraded backend → investigation → incident → evidence

| Step | Current start | Current path | Friction | Proposed |
|------|---------------|--------------|----------|----------|
| 1 Detect | Dashboard exceptions or Ops KPIs | `/app`, `/app/operations` | Duplicate KPIs; unclear which count is authoritative | **Operator Console** with single exception feed |
| 2 Identify backend | Inventory table or dashboard backend list | `/app/backends/inventory` | No “worst backend” ranking on dashboard | Fleet Overview **ranked table** + link |
| 3 Telemetry | Live / Historical | `/app/telemetry/live` | No backend pre-selected from step 2 | Backend Workspace `/app/backends/{id}/telemetry` |
| 4 Calibration context | Calibration status | `/app/telemetry/calibration` | Tab soup | Same workspace **Calibration** tab |
| 5 Jobs impact | Job monitoring | `/app/execution/jobs` | Filter manual | Workspace **Jobs** or deep link `?backendId=` |
| 6 Incident | Alerts → Incidents | `/app/alerts/incidents` | No link from alert row to telemetry window | Alert row **Investigate** → workspace with `at=` |
| 7 Evidence | Reports | `/app/reports` | Manual snapshot | **Create snapshot from incident** (API exists: `createEvidenceSnapshot`) |

**Gap:** Cross-page `at` timestamp and alert id in URL — `NOT_SUPPORTED` in routing today.

#### W2 — Collector failure → provider → recovery

| Step | Page | API | Gap |
|------|------|-----|-----|
| Detect | Platform Health, Ops Centre | `getPlatformHealth`, `getOperationsCentre` | `FEASIBLE_NOW` |
| Diagnose provider | Admin credentials | `getCredentials`, `getAdapterVerification` | Admin page too long — **split Integrations** |
| DLQ | Not in main nav | `getCollectorDlq` | **FE — expose under Collectors** `FRONTEND_CHANGE` |
| Verify | Platform Health | collector status fields | `FEASIBLE_NOW` |

#### W3 — Fleet compare → export

Compare page + Reports (`compareBackends`, `exportReport`) — **FEASIBLE_NOW**; needs **comparison eligibility rules** surfaced in UI (API compare rules — `NEEDS_VERIFICATION` in OpenAPI).

#### W4 — Qubit anomaly → history → advisory health

Anomaly Monitor → Qubit history (`getQubitAnomalies`, `getQubitHistory`) — today **manual backend/qubit selection** on separate routes. Proposed: **Investigate › Anomalies** with row → `/app/backends/{id}/qubits/{idx}`.

#### W5 — Environment event → facility evidence

Environment page (`getEnvironment`, import/ingest) — **NOT_BUILT** live cryo/RF per `pageContext.js` description; UI must not imply live facility stream.

#### W6 — Configure provider → verify coverage

Admin credentials → Metrics Coverage (`getMetricCoverage`) — relationship **not linked in UI**; propose **post-save “View coverage”** deep link.

---

## Section C — Complete information architecture redesign

### C.1 Current IA (verified)

```
Public: /, /login, /register
App shell: /app/*

Sidebar groups (App.jsx):
  Observe: Dashboard | Operations | Backends | Telemetry
  Execute: Execution | Resources
  Record: Reports | Alerts
  Configure: Admin (role)

Secondary tabs (in-content, partial URL):
  Operations: centre | health | timeline  → /app/operations[/health|/timeline]
  Backends: inventory | qubits | details/{id}
  Telemetry: 10 sub-routes  → /app/telemetry/{sub}
  Execution: jobs | queues
  Resources: health | environment | metrics
  Alerts: alerts | incidents
```

### C.2 Proposed IA (workflow-first)

```
Overview
  Fleet Overview          /app/overview          (narrow Dashboard)
  Operator Console        /app/operate           (exceptions + incidents + timeline slice)

Fleet
  Backend Inventory       /app/fleet
  Backend Workspace       /app/fleet/{backendId}/*  (tabs: summary|telemetry|qubits|calibration|jobs|queues|health|topology)

Measure & Analyze  (fleet-wide or workspace-scoped)
  Live stream             /app/analyze/live
  Historical trends       /app/analyze/trends
  Calibration             /app/analyze/calibration
  Drift                   /app/analyze/drift
  Compare                 /app/analyze/compare
  Topology                /app/analyze/topology
  Metrics coverage        /app/analyze/coverage   (single canonical route)

Investigate
  Anomalies               /app/investigate/anomalies
  Temporal replay         /app/investigate/replay
  Operations timeline     /app/investigate/timeline

Execute
  Jobs                    /app/execute/jobs
  Queues                  /app/execute/queues

Resources & advisory
  Resource health         /app/resources/health
  Environment             /app/resources/environment

Record
  Alerts                  /app/record/alerts
  Incidents               /app/record/incidents
  Reports & evidence      /app/record/reports

Platform
  Platform health         /app/platform/health

Configure (admin)
  Integrations            /app/configure/integrations
  Collectors & schedules  /app/configure/collectors
  Alert rules             /app/configure/rules
  Platform settings       /app/configure/platform
```

**Rationale:** Separates **“what’s on fire”** (Operate) from **“what’s the fleet state”** (Overview/Fleet). Collapses duplicate Metrics routes. Moves Platform Health out of “Operations” tab strip to reduce confusion with Operator Console.

### C.3 Route mapping (current → proposed)

| Current | Proposed | Action |
|---------|----------|--------|
| `/app` | `/app/overview` | **Redirect** `/app` → overview; slim widgets |
| `/app/operations` | `/app/operate` | Rename + dedupe KPIs |
| `/app/operations/health` | `/app/platform/health` | Move group |
| `/app/operations/timeline` | `/app/investigate/timeline` | Move group |
| `/app/backends/inventory` | `/app/fleet` | Rename |
| `/app/backends/details/{id}` | `/app/fleet/{id}` | Workspace entry |
| `/app/backends/qubits` | `/app/fleet?q=…` or workspace qubits tab | **Consolidate** |
| `/app/telemetry/*` | `/app/analyze/*` + workspace scoped | Split + context |
| `/app/resources/metrics` | **Retire** | Redirect to `/app/analyze/coverage` |
| `/app/telemetry/metrics` | `/app/analyze/coverage` | Canonical |
| `/app/alerts` | `/app/record/alerts` | Optional prefix |
| `/app/admin` | `/app/configure/*` | **Split** 4 routes |

Compatibility: keep old paths as **302/ client redirects** for one release (`FRONTEND_CHANGE`).

### C.4 Navigation mechanics

| Mechanism | Recommendation | Evidence |
|-----------|----------------|----------|
| Sidebar | 6 top-level groups max; **no 10-tab Telemetry** | Current tab overload |
| Breadcrumbs | `Group › Page › Backend (if scoped)` | Extend `pageContext.js` |
| Context bar | **Backend selector + time range** on Analyze/Investigate | Missing today |
| URL state | `backendId`, `from`, `to`, `metric`, `alertId` query params | `appNav.js` extension |
| Global search | **P2** — search backends/jobs/alerts (`BACKEND_CHANGE` if unified search API missing) |
| Saved views | Dashboard layout prefs exist (`usePageLayout`) — extend to **filters** | `FEASIBLE_NOW` partial |

---

## Section D — Deep page-by-page redesign specification

Each subsection follows the required 12-part template. Shared patterns referenced once in **Section E**; pages cite them.

---

### D.1 Landing

#### 1. Page identity

| Field | Value |
|-------|-------|
| Current name | Landing |
| Current route | `/` |
| Component | `LandingPage.jsx` |
| Proposed name | Landing (unchanged) |
| Proposed route | `/` |
| Nav group | Public |
| Personas | All (pre-auth) |
| Primary purpose | Product entry, sign-in path |

#### 2. Page assessment

Marketing page; not part of operational console. **Works** for entry; **no change** required for observability maturity except consistent product naming (Q-TeleScope / C-DAC).

#### 3. Recommended page boundary

**Remain** single public page.

#### 4–12. (Abbreviated — public scope)

- Hierarchy: hero → capabilities → CTA login.  
- **FEASIBLE_NOW** — copy/design alignment only in implementation phase.  
- Acceptance: reachable without auth; links to `/login`.

**Label:** `VERIFIED` route in `main.jsx`.

---

### D.2 Login

#### 1. Page identity

| Field | Value |
|-------|-------|
| Route | `/login` |
| Component | `LoginPage.jsx` |
| Personas | All authenticated users |
| Purpose | Authenticate (captcha per API) |

#### 2. Assessment

Captcha path (`getCaptcha`, `verifyCaptcha`) — audit notes captcha not exercised in screenshots (`INVENTORY.md`).

#### 3. Boundary

**Remain**; optional **split** marketing chrome from form for a11y.

#### 4. Hierarchy

Form → captcha → error → link register.

#### 5–11.

| Section | Detail |
|---------|--------|
| Data | `api.login`, session in `localStorage.quantum_user` |
| States | Invalid captcha, network error — use shared `ErrorState` pattern |
| Feasibility | `FEASIBLE_NOW` |

#### 12. Acceptance

Successful login lands `/app`; failed login shows message without clearing captcha incorrectly (`NEEDS_VERIFICATION`).

---

### D.3 Registration

Same structure as Login — `RegisterPage.jsx`, `/register`, `api.register`. **Remain** single page. `FEASIBLE_NOW`.

---

### D.4 Dashboard (Fleet Overview)

#### 1. Page identity

| Field | Value |
|-------|-------|
| Current | Dashboard — `/app` — `DashboardHome.jsx`, `DashboardHome.css` |
| Proposed | **Fleet Overview** — `/app/overview` |
| Nav | Overview |
| Personas | Operator, leadership, platform engineer |
| Purpose | **At-a-glance fleet state and ranked exceptions** — not full analysis |

#### 2. Assessment

**Works:** widget customization (`DashboardBentoGrid`, `usePageLayout`), coherence chart, exception buttons.  
**Confusing:** 14 parallel fetches; backend table duplicates Inventory; ops timeline slice duplicates Ops Timeline; two platform health CTAs.  
**Crowded:** exceptions + modality + fleet + ops + jobs panel sequence.  
**Missing:** “last refreshed” per widget; authoritative alert count; worst-backend narrative.

#### 3. Recommended boundary

**Redesign in place → rename role** to Fleet Overview; **remove** panels that belong elsewhere (full backend table → link Fleet; deep ops → Operator Console).  
**Not** merge with Operations Centre.

#### 4. Proposed hierarchy

1. Page header (scope: fleet)  
2. **Exception summary** (severity-ranked, max 5, link each)  
3. **Fleet status strip** (online/offline, collector faults — from `getPlatformHealth` / summary)  
4. **Primary chart:** coherence by backend OR calibration age histogram (`getCoherence`, `getCalibrations`) — user picks one primary  
5. **Secondary:** modality breakdown (compact)  
6. **Recent events** (3–5 from `getOpsTimeline`) — not full table  
7. Customize control (retain)

#### 5. Section inventory (selected)

| Section | User question | Data source | Viz | Priority | Feasibility |
|---------|---------------|-------------|-----|----------|-------------|
| Exceptions | What needs attention now? | `getAlerts('ACTIVE')`, health vector RED counts | Severity list | Critical | `FEASIBLE_NOW` |
| Coherence chart | Who is drifting worst? | `getCoherence` | Bar chart | Primary | `FEASIBLE_NOW` |
| Collector faults | Is ingestion broken? | `getPlatformHealth` | Status list | Primary | `FEASIBLE_NOW` |
| Backend table | — | `getBackends` | Table | **Remove** | Redundant with Fleet |

#### 6. Content design

Prominent: critical alert count, RED qubit count (with link to Resource Health).  
Progressive disclosure: job failure analytics, federated summary.  
Remove duplicate navigation to same Platform Health twice (`DashboardHome.jsx` grep shows duplicate handlers).

#### 7. Visualization

Keep **one primary time-independent ranking chart**; min height 280px in implementation spec.  
Do not add 3D.

#### 8. Interactions

Exception click → `/app/record/alerts?severity=CRITICAL` or Operate.  
Backend row click → `/app/fleet/{id}`.

#### 9. Cross-page

To Inventory/Fleet, Operate, Resource Health, Compare — **preserve** existing callbacks but **reduce** widget count.

#### 10. API feasibility

All listed endpoints exist in `api.js` — `FEASIBLE_NOW`. Unified exception feed — `FRONTEND_CHANGE` (derive from one response).

#### 11. Responsive/a11y

Bento customize: keyboard DnD already via dnd-kit — document focus order in implementation. Mobile: single column, exceptions first.

#### 12. Acceptance

- Overview loads ≤6 primary sections.  
- No full backend inventory table.  
- Single defined source for “active alerts” label.  
- Primary chart ≥280px effective height.

**Evidence:** `DashboardHome.jsx`, screenshots `01-dashboard-*`, audit §7–8.

---

### D.5 Operations Centre → **Operator Console**

#### 1. Identity

| Current | `/app/operations` — `OperationsCentre.jsx` |
| Proposed | **Operator Console** — `/app/operate` |

#### 2. Assessment

**Confusing:** `criticalCount` from client filter vs `ops.active_alerts` vs `alerts.length` (three notions).  
**Redundant** with Dashboard exception strip (`OBSERVED` screenshots 04 vs 01).

#### 3. Boundary

**Remain dedicated page** but **narrow mission** to **action queue**: incidents, alert triage preview, collector/backend faults, federated notes — **not** fleet analytics.

#### 4. Hierarchy

1. Exception strip (aligned definitions with Overview)  
2. Open incidents table (top 10)  
3. Active alerts preview (top 10, severity sort)  
4. Collector/provider fault panel  
5. Federated summary (if enabled)  
6. Link to full timeline

#### 5. Key sections

| Section | API | Interaction |
|---------|-----|-------------|
| Incidents | `getOperationsCentre().incidents`, `getIncidents` | Row → Incidents page |
| Alerts preview | `getAlerts('ACTIVE')` | Row → alert detail drawer (new) |
| Collectors | `getOperationsCentre().collectors` | Link Platform Health |

#### 10. Feasibility

`FEASIBLE_NOW`; alert drawer may be `FRONTEND_CHANGE`.

#### 12. Acceptance

Documented definition: **Active alerts = count from `GET /alerts?status=ACTIVE`** everywhere, or show API field with tooltip if using centre aggregate.

**Evidence:** `OperationsCentre.jsx` lines 27–99.

---

### D.6 Platform Health

#### 1. Identity

| Current | `/app/operations/health` — `PlatformHealth.jsx` |
| Proposed | `/app/platform/health` |

#### 2. Assessment

Database, SSE, collector status — **good SRE page**. Buried under Operations tabs.

#### 3. Boundary

**Move** nav group to Platform; **do not** merge with Operator Console.

#### 4. Hierarchy

1. Platform readiness summary  
2. Database / API checks  
3. Collector health matrix  
4. Ingestion / SSE metadata  
5. Link Configure › Collectors

#### 10. API

`getPlatformHealth`, `getCollectorHealth` — `FEASIBLE_NOW`.

#### 12. Acceptance

Each check row: status, last check time, explanation, link to fix (Configure).

---

### D.7 Backend Inventory → **Fleet registry**

#### 1. Identity

| Current | `/app/backends/inventory` — `BackendInventory.jsx` |
| Proposed | `/app/fleet` |

#### 2. Assessment

Wide table works for search; lacks **fleet summary header** (counts by modality/provider/status).

#### 3. Boundary

**Remain** list page; add **summary band** above table; row opens **Workspace**.

#### 4. Hierarchy

1. Summary chips (online, sim, stub provider)  
2. Filters (existing)  
3. Table  
4. Empty: `EmptyState` panel when no backends

#### 7. Viz

Optional: **status matrix** provider × modality (`FRONTEND_CHANGE`, data from `getBackends`).

#### 9. Cross-page

Row → `/app/fleet/{backend_id}`; queue column → `/app/execute/queues?backendId=`.

#### 12. Acceptance

Filters + sort; summary counts match table rows.

---

### D.8 Backend Details → **Backend Workspace (Summary tab)**

#### 1. Identity

| Current | `/app/backends/details/{id}` — `BackendDetails.jsx` |
| Proposed | `/app/fleet/{backendId}` (default tab Summary) |

#### 2. Assessment

Rich tabs (overview, qubits, calibration, connectivity, execution) but **URL doesn't encode tab**; duplicates Qubit Monitoring.

#### 3. Boundary

**Become workspace shell** with routed sub-tabs:  
`/app/fleet/{id}/summary|telemetry|qubits|calibration|connectivity|jobs`

#### 4. Hierarchy (Summary tab)

1. Backend header (name, provider, modality, operational status)  
2. **Action strip** (refresh, open topology, open health explain)  
3. Queue + pending jobs snapshot  
4. Modality extensions / classical infra (C-DAC only)  
5. **Not** wall of marketing hardware prose — shorten to registry fields

#### 10. API

`getBackendDetail`, `getBackendStatus`, `getBackendQueue`, `getJobs`, etc. — `FEASIBLE_NOW`.

#### 12. Acceptance

Tab change updates URL; back returns to Fleet with filter preserved (query).

---

### D.9 Qubit Monitoring

#### 1. Identity

| Current | `/app/backends/qubits` — `QubitMonitoring.jsx` |
| Proposed | **Fleet-wide Qubit explorer** `/app/fleet/qubits` OR workspace tab only |

#### 3. Boundary

**Consolidate** with workspace qubits tab; fleet-wide page only for **cross-backend** sort/filter (retain if persona needs compare across backends).

#### 4. Hierarchy

1. Backend selector  
2. Filter/sort  
3. Paginated table  
4. Chart panel for selected qubit history

#### 10. API

`getBackendQubits`, `getQubitHistory` — `FEASIBLE_NOW`.

---

### D.10 Live Telemetry

#### 1. Identity

| Route | `/app/telemetry/live` → `/app/analyze/live` |
| Component | `LiveTelemetry.jsx` |

#### 2. Assessment

SSE stream + KPI grid + log; needs **staleness** and stream kind from API (`events` router — `NEEDS_VERIFICATION`).

#### 3. Boundary

**Remain**; scope with global/backend context bar.

#### 7. Viz

Time-series (ECharts); show **stream metadata** banner.

#### 8. Actions

Refresh/reconnect; pause log autoscroll.

#### 12. Acceptance

Disconnected stream shows panel empty state (already `EmptyState`); display last event time.

---

### D.11 Calibration Status

**Proposed route:** `/app/analyze/calibration`  
**API:** `getCalibrations`, `getBackendCalibration`  
**Purpose:** Fleet calibration freshness table.  
**Split vs Timeline:** Status = **snapshot**; Timeline = **events series** — keep both, group under **Calibration** nav subgroup.  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.12 Drift Analysis

**Route:** `/app/analyze/drift` — `DriftAnalysis.jsx`  
**API:** `getDriftSummaries`, `getDriftAnalysis`, `getBackendDrift`  
**Hierarchy:** backend/qubit/metric selectors → chart → interpretation panel (use explain if added)  
**Gap:** Job linkage — `NOT_SUPPORTED` unless API adds cross-ref.  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.13 Historical Trends

**Route:** `/app/analyze/trends` — `HistoricalTrends.jsx`  
**Requires:** historical points in DB — empty states must explain retention (`DATA_PIPELINE_CHANGE` if retention short).  
**Feasibility:** `FEASIBLE_NOW` UI; data depth `NEEDS_VERIFICATION`.

---

### D.14 Topology Explorer

**Route:** `/app/analyze/topology` — `TopologyExplorer.jsx`  
**API:** `getBackendTopology`  
**Viz:** Force graph (ECharts) — **2D sufficient**; 3D **not recommended** (no spatial benefit for abstract coupling graph).  
**A11y:** Table of edges as alternative (`FRONTEND_CHANGE`).  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.15 Calibration Timeline

**Route:** `/app/analyze/calibration/timeline` or nested tab  
**API:** `getCalibrationTimeline`  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.16 Backend Comparison

**Route:** `/app/analyze/compare` — `BackendComparison.jsx`  
**API:** `compareBackends` POST  
**Rules:** Same-modality constraint — surface in UI before POST (`VERIFIED` empty state message).  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.17 Anomaly Monitor

**Route:** `/app/investigate/anomalies` — `AnomalyMonitor.jsx`  
**API:** `getAnomalySummary`, `getQubitAnomalies`  
**Cross-page:** Row → workspace qubit with metric preselected.  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.18 Temporal Replay

**Route:** `/app/investigate/replay` — `TemporalReplay.jsx`  
**API:** `getReplayTimeline`, `getReplayFrame`  
**Trust:** Label as **stored telemetry scrub**, not vendor rewind (`temporal_replay.py` docstring — `VERIFIED`).  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.19 Metrics Coverage (canonical)

#### 1. Identity

| Current | Two routes: `/app/telemetry/metrics`, `/app/resources/metrics` |
| Component | `MetricsCoverage.jsx` (same) |

#### 3. Boundary

**Single canonical page** `/app/analyze/coverage`; **retire duplicate** resource route with redirect.

#### 4. Hierarchy

1. Backend selector  
2. Coverage matrix / capability flags  
3. Link to Configure › Integrations for gaps

#### 10. API

`getMetricCoverage`, `getBackendMetricCoverage`, `getMetricCapabilities` — `FEASIBLE_NOW`.

---

### D.20 Job Monitoring

**Route:** `/app/execute/jobs` — `JobMonitoring.jsx`  
**API:** `getJobs`, `getJobFailureAnalytics`  
**Hierarchy:** filters → failure analytics KPIs → paginated table  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.21 Queue Monitoring

**Route:** `/app/execute/queues` — `QueueMonitoring.jsx`  
**API:** `getQueues`, `getQueueAnalytics`  
**Viz opportunity:** wait-time distribution from analytics summary — `FEASIBLE_NOW` if endpoint returns histogram (`NEEDS_VERIFICATION` schema).

---

### D.22 Resource Health

#### 1. Identity

| Route | `/app/resources/health` — `ResourceHealth.jsx` |

#### 2. Assessment

Advisory router model; quarantine is **local DB** only — must stay prominent. Module list is **implementation metadata** for engineers, not operators.

#### 3. Boundary

**Remain**; **restructure** content (recent FE improved legend/reference fold — blueprint codifies target):

#### 4. Hierarchy

1. Action bar (RED counts, quarantine all RED) + scope disclaimer  
2. Compact G/Y/R legend  
3. Backend accordion list (primary)  
4. Reference fold (H vector definition, module table) — **default collapsed**  
5. Remove duplicate metric tiles on collapsed rows

#### 6. Content

Prominent: RED count, backend name, recommended_action.  
Hidden: module capability IDs except in Reference.  
Tooltips: F_limit, η_cal via `InfoTooltip` + glossary (`healthGlossary.js`).

#### 8. Actions

Quarantine/release (`quarantineQubit`, `releaseQubit`, `applyHealthRouter`) — confirm dialogs (exist).

#### 10. API

`getHealthVector`, `getHealthModules`, `getHealthExplainBackend` — `FEASIBLE_NOW`.

#### 12. Acceptance

Operator completes triage without reading module table; engineer can open Reference.

**Evidence:** `ResourceHealth.jsx`, `app/api/health.py`, screenshot `22-resource-health-*`.

---

### D.23 Environment

**Route:** `/app/resources/environment` — `EnvironmentPage.jsx`  
**API:** import/export/ingest endpoints  
**Trust:** Imported facility data — **not live cryo** (`pageContext.js`) — banner mandatory.  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.24 Alerts

**Route:** `/app/alerts` — `AlertsEvents.jsx` (alerts view)  
**API:** `getAlerts`, acknowledge, resolve  
**Hierarchy:** filters → table → bulk actions (future)  
**Cross-page:** Open timeline at `detected_at` — needs URL context (`FRONTEND_CHANGE`).

---

### D.25 Incidents

**Route:** `/app/alerts/incidents` — same component, incidents view  
**API:** incidents CRUD workflow endpoints in `api.js`  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.26 Reports & Evidence

**Route:** `/app/reports` — `ReportsPage.jsx`  
**API:** export URLs, `listEvidenceSnapshots`, `createEvidenceSnapshot`  
**Gap:** Manifest preview — `FRONTEND_CHANGE`; signed hash display — `NEEDS_VERIFICATION`.

---

### D.27 Operations Timeline

**Route:** `/app/operations/timeline` → `/app/investigate/timeline` — `OpsTimeline.jsx`  
**API:** `getOpsTimeline`  
**Feasibility:** `FEASIBLE_NOW`.

---

### D.28 Administration → **Configure hub (split)**

#### 1. Identity

| Current | `/app/admin` — `AdministrationPage.jsx` (~630+ lines) |
| Proposed | Hub + 4 sub-routes |

#### 2. Assessment

Combines: auto-discovery, env/mock strip, credentials, schedules, alert rules, modal — **too many roles one scroll**.

#### 3. Boundary

**Split:**

| New page | Content from admin |
|----------|-------------------|
| Integrations | Credentials, adapter verification, IBM token |
| Collectors | Schedules, collector health links, DLQ |
| Alert rules | Rules table + modal |
| Platform | Mock/catalog flags, provenance, deployment profile, retention |

#### 4. Hierarchy (Integrations example)

1. Provider cards with LIVE/STUB badge from `getAdapterVerification`  
2. Save/test actions  
3. Link coverage matrix

#### 10. API

All exist under `/admin/*` in `api.js` — `FEASIBLE_NOW` with routing split `FRONTEND_CHANGE`.

#### 12. Acceptance

No single page scroll > 2 viewports without nav.

---

## Section E — Global design system proposal

### Typography

| Role | Spec |
|------|------|
| Page title | 20–22px semibold — `PageHeader` only (one H1 per view) |
| Section | 14px bold — `.page-section-title` |
| KPI value | 20–24px tabular nums — JetBrains Mono |
| Table | 12–13px; compact mode 11.5px |
| Technical id | Mono 11px — `code` |
| Formula | Glossary drawer only — not page titles |

### Spacing & density

- Base page stack gap: 12px (`page-stack`)  
- **Comfortable / Compact** toggle on `.page-container` — affects table padding and chart min-heights  
- Wide screens: max-width **none** but use **2-column analysis layouts** where primary+secondary (chart + table)

### Status colors

Semantic only: critical/warning/healthy/info/neutral/stale/error — map existing badges; **remove decorative** badge use on Platform Health rows (audit finding).

### Component patterns

Reuse: `PageHeader`, `RefreshButton`, `ChartPanel`, `EmptyState`/`ErrorState`/`TableEmpty`, `InfoTooltip`, `DataProvenanceBar`.  
New: **ContextBar** (backend, time range), **ExceptionList**, **WorkspaceTabNav**.

### Theme

Charts via `chartTheme.js`; no hardcoded `#0f172a` in page JSX (audit noted JobMonitoring inline colors).

---

## Section F — Cross-page context model

| Context | Scope | URL | Persist |
|---------|-------|-----|---------|
| `backendId` | Analyze, Investigate, Execute filters | `/app/fleet/{id}/…` or `?backendId=` | session optional |
| Time range | Trends, drift, replay, telemetry | `?from=&to=` ISO | per-page last used |
| `metric` | Drift, anomalies | `?metric=t1` | no |
| `alertId` / `incidentId` | Record | `?alertId=` | no |
| Dashboard layout | Overview | localStorage (`usePageLayout`) | yes |

**Deep link convention (proposed):**

```
/app/fleet/{backendId}/telemetry?metric=T1&from=2026-10-01T00:00:00+05:30&to=...
/app/record/alerts?status=ACTIVE&severity=CRITICAL
/app/investigate/timeline?correlationId=
```

Verify against React Router refactors — `FRONTEND_CHANGE`.

---

## Section G — Charts and visualization portfolio

| Name | Page | Question | Data | Type | Readiness | Priority | Effort |
|------|------|----------|------|------|-----------|----------|--------|
| Coherence ranking | Overview | Who is worst T1/T2? | `getCoherence` | Bar | Available | P0 | S |
| Calibration age histogram | Overview / Calibration | How stale? | `getCalibrations` | Histogram | `NEEDS_VERIFICATION` bins | P1 | M |
| Queue wait distribution | Queues | Pressure? | `getQueueAnalytics` | Histogram | `NEEDS_VERIFICATION` | P1 | M |
| Drift series | Drift | Which qubit drifting? | `getDriftAnalysis` | Line | Available | P1 | S |
| Topology graph | Topology | Coupling health? | `getBackendTopology` | Graph 2D | Available | P2 | M |
| Replay scrub | Replay | What changed over time? | `getReplayTimeline` | Scrub + KPI | Available | P2 | S |
| Anomaly hits | Anomalies | Where EWMA fired? | `getAnomalySummary` | Table + spark | Available | P1 | S |
| Fleet health over time | Overview | Trend of RED? | Health history | Line | **Missing series** | P2 | L — `BACKEND_CHANGE` |
| 3D QPU layout | — | — | — | — | **Not recommended** without hardware CAD | P3 | — |

---

## Section H — Empty, partial, stale, simulated states

Global rules:

| State | Pattern |
|-------|---------|
| Loading | `BoneyardSkeleton` matched to layout |
| Empty | `EmptyState variant="panel"` page-level; `TableEmpty` in tables |
| Error | `ErrorState variant="panel"` + retry |
| Stale | Show age next to refresh hover (`RefreshButton`) + provenance bar |
| Simulated/mock | No “Simulated” chip in chrome; provenance line (`DataProvenanceBar`) |
| Unsupported | `NOT_BUILT` banner (Environment live cryo) |
| Partial | ChartPanel `state='empty'` with explanation |

Per-page messages documented in Section D; implementation must not leave blank chart containers.

---

## Section I — Data truth and provenance

Layers:

1. **Hardware/provider measurement** — telemetry endpoints  
2. **Platform DB snapshot** — jobs, alerts, quarantine  
3. **Derived** — health vector, anomalies, drift  
4. **Advisory** — router G/Y/R, quarantine  
5. **Imported** — environment CSV  
6. **Cached/mock** — config status driven  

Presentation: single slim **provenance bar** + per-panel `(i)` for formulas; avoid per-row badge soup.

---

## Section J — Product and technical gaps

| Feature | User value | Gap | Work |
|---------|------------|-----|------|
| Unified alert counts | Trust | Multiple UI sources | `FRONTEND_CHANGE` or API aggregate |
| Alert → telemetry window | Investigation | No URL time slice | `FRONTEND_CHANGE` |
| Fleet health history | Trending RED | No time series endpoint | `BACKEND_CHANGE` |
| Global search | Speed | No API | `BACKEND_CHANGE` |
| Role-based nav | Security | Admin-only gate | `BACKEND_CHANGE` RBAC |
| DLQ viewer | SRE | API exists, no page | `FRONTEND_CHANGE` |
| Tab deep links on Backend Details | Shareable state | Tab not in URL | `FRONTEND_CHANGE` |
| Live facility MQTT | Operator | `NOT_BUILT` per copy | Adapter work |
| Saved time range | Analysis | Not in URL | `FRONTEND_CHANGE` |

---

## Section K — Prioritized roadmap

### P0 — Trust, IA, navigation (Sprints A–B)

- Dedupe alert semantics Overview vs Operate  
- Split Admin configure routes  
- Canonical Metrics Coverage route  
- Fleet Overview slim-down  
- Backend Workspace URL tabs  
- Context bar (backend + time) on Analyze pages  

### P1 — Core workspaces (Sprints C–E)

- Operator Console incident/alert queues  
- Resource Health hierarchy (reference fold)  
- Cross-links alert → timeline → backend  
- Queue analytics visualization  
- Environment trust banners  

### P2 — Analysis depth (Sprints F–G)

- Calibration histograms  
- Fleet health history (if backend ready)  
- Topology edge table a11y  
- Saved views extension  

### P3 — Polish

- Global search  
- Optional sparklines in inventory  
- Mobile nav drawer refinements  

Each phase: regression on `appNav.js` redirects; screenshot diff key routes.

---

## Section L — Implementation-ready matrix

| Current page | Current route | Proposed page | Proposed route | Nav group | Primary persona | Primary task | Current problems | Boundary | Priority | Sprint |
|--------------|---------------|---------------|----------------|-----------|-----------------|--------------|------------------|----------|----------|--------|
| Dashboard | `/app` | Fleet Overview | `/app/overview` | Overview | Operator | See fleet exceptions | Overfetch, duplicate table | Slim | P0 | A |
| Operations Centre | `/app/operations` | Operator Console | `/app/operate` | Operate | Incident responder | Triage queue | Duplicate KPIs, alert count conflict | Refocus | P0 | A |
| Platform Health | `/app/operations/health` | Platform Health | `/app/platform/health` | Platform | SRE | Check ingestion | Hidden under ops tabs | Move | P0 | A |
| Backend Inventory | `/app/backends/inventory` | Fleet | `/app/fleet` | Fleet | Engineer | Find backend | Table-only | +summary | P1 | B |
| Backend Details | `/app/backends/details/{id}` | Workspace | `/app/fleet/{id}/*` | Fleet | Engineer | Deep dive | Tab URL missing | Workspace | P0 | B |
| Qubit Monitoring | `/app/backends/qubits` | Qubit explorer | `/app/fleet/qubits` or tab | Fleet | Engineer | Inspect qubits | Duplicates workspace | Consolidate | P1 | C |
| Live Telemetry | `/app/telemetry/live` | Live | `/app/analyze/live` | Analyze | Engineer | Stream | Staleness | +context | P1 | C |
| Calibration Status | `/app/telemetry/calibration` | Calibration | `/app/analyze/calibration` | Analyze | Cal engineer | Freshness | Tab overload | Group | P1 | C |
| Drift | `/app/telemetry/drift` | Drift | `/app/analyze/drift` | Analyze | Engineer | Detect drift | — | Context | P1 | C |
| Historical Trends | `/app/telemetry/trends` | Trends | `/app/analyze/trends` | Analyze | Researcher | Long window | Data gaps | +retention msg | P1 | C |
| Topology | `/app/telemetry/topology` | Topology | `/app/analyze/topology` | Analyze | Engineer | Coupling | a11y graph | +table alt | P2 | D |
| Cal Timeline | `/app/telemetry/cal-timeline` | Cal timeline | `/app/analyze/calibration/timeline` | Analyze | Cal engineer | Events | — | Nested | P2 | D |
| Compare | `/app/telemetry/compare` | Compare | `/app/analyze/compare` | Analyze | Researcher | Compare QPUs | Rules unclear | +copy | P1 | C |
| Anomalies | `/app/telemetry/anomalies` | Anomalies | `/app/investigate/anomalies` | Investigate | SRE | Find outliers | Isolated | +drill | P1 | D |
| Replay | `/app/telemetry/replay` | Replay | `/app/investigate/replay` | Investigate | Engineer | Scrub history | Trust label | Keep | P2 | D |
| Metrics (tel) | `/app/telemetry/metrics` | Coverage | `/app/analyze/coverage` | Analyze | Admin | See gaps | Duplicate route | Canonical | P0 | A |
| Metrics (res) | `/app/resources/metrics` | — | redirect | — | — | — | Duplicate | Retire | P0 | A |
| Jobs | `/app/execution/jobs` | Jobs | `/app/execute/jobs` | Execute | Operator | Monitor jobs | — | — | P1 | C |
| Queues | `/app/execution/queues` | Queues | `/app/execute/queues` | Execute | Operator | Queue pressure | Chart opportunity | +viz | P1 | C |
| Resource Health | `/app/resources/health` | Resource Health | `/app/resources/health` | Resources | Operator | Advisory quarantine | Model noise | Reference fold | P0 | B |
| Environment | `/app/resources/environment` | Environment | `/app/resources/environment` | Resources | Facility | Import facility | NOT_BUILT live | Banners | P1 | C |
| Alerts | `/app/alerts` | Alerts | `/app/record/alerts` | Record | Responder | Triage | No drill | +links | P1 | D |
| Incidents | `/app/alerts/incidents` | Incidents | `/app/record/incidents` | Record | Responder | Workflow | — | — | P1 | D |
| Reports | `/app/reports` | Reports | `/app/record/reports` | Record | Audit | Export | Preview weak | +manifest | P2 | E |
| Ops Timeline | `/app/operations/timeline` | Timeline | `/app/investigate/timeline` | Investigate | Responder | Correlate | — | Move | P1 | D |
| Admin | `/app/admin` | Configure * | `/app/configure/*` | Configure | Admin | Configure | Too long | Split 4 | P0 | A |
| Landing/Login/Register | `/`, `/login`, `/register` | unchanged | — | Public | All | Auth | — | Keep | P3 | — |

---

## Section M — Evidence and traceability

| ID | Claim | Label |
|----|-------|-------|
| E1 | 27 page components under `frontend/src/pages/` | `VERIFIED` |
| E2 | URL mapping in `appNav.js` | `VERIFIED` |
| E3 | API client methods in `api.js` | `VERIFIED` |
| E4 | Dashboard multi-fetch | `VERIFIED` `DashboardHome.jsx` |
| E5 | Ops centre alert duplication | `VERIFIED` `OperationsCentre.jsx` |
| E6 | Metrics duplicate routes | `VERIFIED` `INVENTORY.md` |
| E7 | Screenshot set 2026-10-31 | `OBSERVED` |
| E8 | Runtime empty/error at 390px | `NEEDS_VERIFICATION` |
| E9 | Queue analytics histogram fields | `NEEDS_VERIFICATION` |
| E10 | Compare API modality rules | `NEEDS_VERIFICATION` |

---

## Final response summary

1. **Blueprint path:** [`QTelescope_Comprehensive_UI_Product_Redesign_Blueprint.md`](QTelescope_Comprehensive_UI_Product_Redesign_Blueprint.md)

2. **Most important product findings:** Dashboard and Operations Centre duplicate exception KPIs with **inconsistent alert semantics**; Telemetry **10-tab strip** hides analysis tools without shared backend/time context; Admin **monolith** mixes integration, collectors, and rules; Backend details and Qubit monitoring **overlap**; Metrics Coverage **duplicated** on two routes; Resource Health must separate **operator actions** from **model/module reference**.

3. **Proposed IA:** Overview (Fleet Overview + Operator Console) · Fleet (registry + backend workspace) · Analyze · Investigate · Execute · Resources · Record · Platform · Configure — with route mapping and redirects from current `/app/*`.

4. **Highest-priority redesigns:** Fleet Overview slim-down; Operator Console dedupe; Backend Workspace with URL tabs; Configure split; canonical coverage route; Resource Health hierarchy; global context bar.

5. **Main backend/data dependencies:** Optional unified exception aggregate; fleet health **time series**; global search API; queue analytics shape verification; retention policy surfacing for historical charts.

6. **Not verified this session:** Live browser re-run; mobile 390px; modal states; empty DB; queue analytics histogram schema; compare eligibility API details.

7. **Source code:** **No application source files were modified** — only this Markdown deliverable was added.

---

## Appendix — Extended page specifications (full 12-part template)

Pages D.1–D.3, D.4–D.9, D.22–D.28 are fully expanded above. Below completes D.10–D.21 with all required subsections.

### D.10 Live Telemetry — full template

| # | Detail |
|---|--------|
| **1 Identity** | Current: Live Telemetry, `/app/telemetry/live`, `LiveTelemetry.jsx`. Proposed: `/app/analyze/live`. Group: Analyze. Personas: HW engineer, platform engineer. Purpose: Monitor platform refresh stream and recent backend/qubit events. |
| **2 Assessment** | Works: SSE + KPI grid + log panel. Confusing: stream vs poll not obvious. Empty: disconnected SSE. Missing: backend-scoped filter, staleness SLA. |
| **3 Boundary** | Remain dedicated page; add optional scope to fleet workspace tab later. |
| **4 Hierarchy** | (1) Stream status banner (2) Backend/modality KPI strip (3) Primary chart (4) Event log (5) Link to Historical for same backend. |
| **5 Inventory** | Stream status → `events` SSE + metadata API if exposed; KPIs → latest telemetry aggregates; Chart → time series from stream; Log → parsed events. Priority: stream banner critical. |
| **6 Content** | Prominent: connection state, last event time. Secondary: modality counts. Hide: raw JSON unless debug role. |
| **7 Viz** | Line chart for rolling metric; log as monospace list. No 3D. A11y: log is primary textual alternative to chart. |
| **8 Interactions** | Refresh page; filter log; click backend → workspace. No pause vendor stream (not supported). |
| **9 Cross-page** | → Historical trends with `backendId`; → Platform health if stream ERROR. |
| **10 Feasibility** | SSE in FE today — `FEASIBLE_NOW`; stream metadata — `NEEDS_VERIFICATION`. |
| **11 Responsive** | Stack chart over log on `<900px`. |
| **12 Acceptance** | Disconnected shows panel error; connected shows non-empty log or explicit empty stream message. |

### D.11 Calibration Status — full template

| # | Detail |
|---|--------|
| **1** | `/app/telemetry/calibration`, `CalibrationStatus.jsx` → `/app/analyze/calibration`. Cal engineer. Snapshot freshness across fleet. |
| **2** | Table of backends; works for triage. Missing: sort by age, link to timeline. |
| **3** | Remain; pair with Calibration Timeline under submenu. |
| **4** | Filter → summary counts → table → row → workspace calibration tab. |
| **5** | `getCalibrations`, `getBackendCalibration` — table columns: backend, identifier, freshness_status, timestamp. |
| **6** | Prominent: FRESH/STALE/EXPIRED; explain freshness rules in tooltip. |
| **7** | Optional bar: count by freshness (`FRONTEND_CHANGE`). |
| **8** | Row click → `/app/fleet/{id}/calibration`. |
| **9** | → Cal timeline, → Drift, → Jobs using snapshot id if field present. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Dense table on mobile with horizontal scroll. |
| **12** | Empty fleet → panel EmptyState with link to Admin discovery. |

### D.12 Drift Analysis — full template

| # | Detail |
|---|--------|
| **1** | `DriftAnalysis.jsx`, `/app/telemetry/drift` → `/app/analyze/drift`. Engineer. Detect metric drift vs baseline. |
| **2** | Chart + controls work; interpretation left to user. |
| **3** | Remain. |
| **4** | Backend/qubit/metric selectors → chart → drift summary table. |
| **5** | `getDriftSummaries`, `getDriftAnalysis`, `getBackendDrift`, `getQubitDrift`. |
| **6** | Show units (µs vs dimensionless readout). |
| **7** | Line chart vs baseline; small multiples P2. |
| **8** | Change metric/backend resets chart; refresh header action. |
| **9** | → Anomalies if drift threshold crossed; → Qubit history. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Chart min-height 280px comfortable. |
| **12** | No backends → panel empty with Admin link. |

### D.13 Historical Trends — full template

| # | Detail |
|---|--------|
| **1** | `HistoricalTrends.jsx`, `/app/telemetry/trends` → `/app/analyze/trends`. Researcher/ engineer. Long-window metric trends. |
| **2** | Filter bar exists; empty chart if sparse DB. |
| **3** | Remain. |
| **4** | Time window + backend + metric → multi-chart grid. |
| **5** | Backend telemetry + qubit history endpoints (verify window params in component). |
| **6** | Show retention limit in hint when API returns truncated series. |
| **7** | Line charts auto-fit grid. |
| **8** | Global time range in URL (`FRONTEND_CHANGE`). |
| **9** | → Live telemetry same backend; → Export report. |
| **10** | UI `FEASIBLE_NOW`; retention messaging may need `BACKEND_CHANGE` for explicit `truncated` flag. |
| **11** | Single column charts on mobile. |
| **12** | Empty series → chart panel empty with “increase collection or widen window”. |

### D.14 Topology Explorer — full template

| # | Detail |
|---|--------|
| **1** | `TopologyExplorer.jsx`, `/app/telemetry/topology` → `/app/analyze/topology`. Engineer. Coupling + health overlay. |
| **2** | Force graph useful; large QPUs hide labels (existing). |
| **3** | Remain; optional embed in workspace. |
| **4** | Backend + color mode → graph → selected node detail strip. |
| **5** | `getBackendTopology` — nodes, edges, health fields. |
| **6** | Color legend for health/T1/readout. |
| **7** | 2D graph only; table alternative for a11y P1. |
| **8** | Click node → qubit detail; double-click → workspace qubit. |
| **9** | → Resource health qubit row; → Qubit history. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Graph height clamp 50vh; pan/zoom keyboard `NEEDS_VERIFICATION`. |
| **12** | No edges → inline empty, not blank canvas. |

### D.15 Calibration Timeline — full template

| # | Detail |
|---|--------|
| **1** | `CalibrationTimeline.jsx`, `/app/telemetry/cal-timeline` → `/app/analyze/calibration/timeline`. Cal engineer. Events over time. |
| **2** | Chart + events table; good split. |
| **3** | Remain nested under Calibration. |
| **4** | Backend + window → chart → events table (cap rows). |
| **5** | `getCalibrationTimeline` — telemetry + `calibration_events`. |
| **6** | Timestamps IST; identifier prominent. |
| **7** | Timeline chart + table alt. |
| **8** | Window hours selector. |
| **9** | → Calibration status row; → Backend workspace. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Table scroll max-height. |
| **12** | No events → empty chart + hint wait for collectors. |

### D.16 Backend Comparison — full template

| # | Detail |
|---|--------|
| **1** | `BackendComparison.jsx`, `/app/telemetry/compare` → `/app/analyze/compare`. Researcher. Pairwise backend metrics. |
| **2** | Multi-select + results; eligibility rules confuse users. |
| **3** | Remain. |
| **4** | Backend multiselect → compare action → delta table/cards. |
| **5** | `compareBackends` POST. |
| **6** | Explain non-comparable pairs before submit. |
| **7** | Table primary; radar optional P3 if same units. |
| **8** | Compare button disabled until ≥2 valid backends. |
| **9** | → Metrics coverage; → Reports export. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Multiselect accessible listbox. |
| **12** | Empty pair deltas → TableEmpty with rule explanation. |

### D.17 Anomaly Monitor — full template

| # | Detail |
|---|--------|
| **1** | `AnomalyMonitor.jsx`, `/app/telemetry/anomalies` → `/app/investigate/anomalies`. SRE/engineer. EWMA/changepoint hits. |
| **2** | KPI + table; advisory copy present. |
| **3** | Remain under Investigate. |
| **4** | Metric select → KPI grid → hits table. |
| **5** | `getAnomalySummary`, `getQubitAnomalies`. |
| **6** | Flags column plain language tooltips. |
| **7** | Sparklines P2 per hit. |
| **8** | Row → workspace qubit. |
| **9** | → Drift; → Resource health. |
| **10** | `FEASIBLE_NOW`. |
| **11** | KPI grid uses `page-kpi-grid`. |
| **12** | No hits → TableEmpty (scan clean message). |

### D.18 Temporal Replay — full template

| # | Detail |
|---|--------|
| **1** | `TemporalReplay.jsx`, `/app/telemetry/replay` → `/app/investigate/replay`. Engineer. Scrub stored frames. |
| **2** | Scrubber + KPI panels; honest methodology string. |
| **3** | Remain. |
| **4** | Backend → scrub → KPI triplet (queue, T1 mean, calibration). |
| **5** | `getReplayTimeline`, `getReplayFrame`. |
| **6** | Label “platform DB replay” not vendor time travel. |
| **7** | Scrub + KPI cards; no 3D. |
| **8** | Scrub input; refresh reloads timeline. |
| **9** | → Live/historical same backend at frame time. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Scrub bar full width mobile. |
| **12** | No frames → panel empty wait for collectors. |

### D.19 Metrics Coverage — full template

| # | Detail |
|---|--------|
| **1** | `MetricsCoverage.jsx`, dual routes → single `/app/analyze/coverage`. Admin/engineer. Provider metric matrix. |
| **2** | Duplicate route confuses IA. |
| **3** | One canonical page; redirect resource path. |
| **4** | Backend select → capability matrix → gaps list. |
| **5** | `getMetricCoverage`, `getBackendMetricCoverage`, `getMetricCapabilities`. |
| **6** | STUB/NOT_BUILT clearly labeled. |
| **7** | Matrix table; heatmap P2. |
| **8** | Click gap → Configure integrations. |
| **9** | → Telemetry pages for LIVE metrics. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Matrix horizontal scroll. |
| **12** | No backends → EmptyState panel. |

### D.20 Job Monitoring — full template

| # | Detail |
|---|--------|
| **1** | `JobMonitoring.jsx`, `/app/execution/jobs` → `/app/execute/jobs`. Operator. Observed jobs only. |
| **2** | Heavy table + filters; not submission UI. |
| **3** | Remain. |
| **4** | Filters → failure analytics strip → paginated table. |
| **5** | `getJobs`, `getJobFailureAnalytics`. |
| **6** | Runtime units; failure class glossary. |
| **7** | Failure analytics KPIs; outcome pie P2. |
| **8** | Filter/search/sort/paginate. |
| **9** | → Backend workspace; → Alerts if linked. |
| **10** | `FEASIBLE_NOW`. |
| **11** | Remove hardcoded light-theme colors in cells (audit). |
| **12** | No rows → TableEmpty. |

### D.21 Queue Monitoring — full template

| # | Detail |
|---|--------|
| **1** | `QueueMonitoring.jsx`, `/app/execution/queues` → `/app/execute/queues`. Operator. Queue depth/wait. |
| **2** | KPI cards + analytics table added. |
| **3** | Remain. |
| **4** | Fleet KPIs → per-backend cards → analytics summary table. |
| **5** | `getQueues`, `getQueueAnalytics`. |
| **6** | Wait time seconds labeled. |
| **7** | Distribution chart if analytics supports bins. |
| **8** | Card → backend queue detail API. |
| **9** | → Jobs same backend; → Live telemetry. |
| **10** | Table `FEASIBLE_NOW`; histogram `NEEDS_VERIFICATION`. |
| **11** | Cards stack mobile. |
| **12** | Empty queues → EmptyState with collector hint. |

---

*End of blueprint — await review before implementation.*
