# Q-TeleScope — Deep Frontend UX/UI, Visual Quality, Information Density, and Usability Audit

**Date:** 2026-10-31  
**Scope:** Analysis only — no application source changes in this deliverable.  
**Auditor method:** Running app at `127.0.0.1:5173` + API at `127.0.0.1:8000`; 31 full-page Playwright screenshots; line-level review of `frontend/src/**`.

---

## 1. Executive summary

Q-TeleScope has **broad functional coverage** (25+ in-app routes, ECharts on several telemetry pages, tables with sorting on inventory/jobs, honesty work via `DataProvenanceBar` and provider truth labels). Visually and operationally it still reads as a **generic card dashboard**: repeated KPI grids, **one primary chart on the home dashboard**, large empty regions inside chart cards, and **engineer-facing prose dumped into UI** (health vector formula, module badge strings) instead of **progressive disclosure** (Cert Studio–style info icons + hover/focus help).

Your complaints match runtime evidence:

| Symptom | Verified | Primary cause |
|---------|----------|----------------|
| Too much gap, too little useful content | Yes (dashboard chart ~180px tall in tall card; wide desktop under-used) | Fixed chart heights; no density modes; no secondary charts |
| Dashboard not dynamic / one chart | Yes | `DashboardHome.jsx` — single T1/T2 bar chart + table |
| “AI sloppy” badge lines on Resource Health | Yes | `ResourceHealth.jsx` — 12+ `LIVE · observe` chips + wall of model text |
| Weak tooltips | Yes | Native `title=` only in a few places; no shared `InfoTooltip` |
| No dashboard customization | Yes | No layout prefs, saved views, or widget registry in FE |

**Recommended direction (post-review implementation):** Observability-grade shell (Grafana-like panel grid + descriptions), **density toggle**, **dashboard layouts A/B/C** (saved views), and a **single glossary/help layer** for health model and LIVE/STUB/NOT_BUILT — not inline badge soup.

---

## 2. Actual application / runtime verification

| Check | Result |
|-------|--------|
| Frontend reachable | HTTP 200 on `:5173` |
| API reachable | HTTP 200 on `/api/v1/backends` |
| Logged-in console | Yes — admin session for screenshot run |
| Light + dark theme | Dark dashboard captured |
| Viewports | 1440×900 (primary), 768×1024 (tablet), one MCP viewport shot |
| Captcha login path | **Not** exercised in screenshot run (session injection) |
| WCAG axe | **Not** run — checklist is code/review-based |
| Empty / error states | Partially — only populated mock catalog observed |

Evidence folder: [`audit/frontend-screenshots/2026-10-31/`](audit/frontend-screenshots/2026-10-31/INVENTORY.md).

---

## 3. Screenshot inventory

See **[INVENTORY.md](audit/frontend-screenshots/2026-10-31/INVENTORY.md)** for all 31 files and routes. Key references:

- Dashboard whitespace / single chart: `01-dashboard-light-1440x900.png`
- Health vector + module badges: `22-resource-health-1440x900.png`
- Operations KPI clone of dashboard: `04-operations-centre-1440x900.png`
- Admin provider truth + legacy copy: `28-administration-1440x900.png`

---

## 4. Current frontend architecture

| Layer | Location | Notes |
|-------|----------|--------|
| Entry / routes | `frontend/src/main.jsx` | Public `/`, `/login`, `/register`; app shell `/app/*` |
| Shell | `frontend/src/App.jsx` | Sidebar topics, `tab-header` sub-nav, `page-container`, `DataProvenanceBar` |
| Deep links | `frontend/src/appNav.js` | URL ↔ nav state |
| API | `frontend/src/services/api.js` | Bearer + `X-User-Role`; ~80 endpoints |
| Styling | `frontend/src/index.css` + per-page CSS | CSS variables, Tailwind import, `.card`, `.grid-summary`, `.tab-header` |
| Charts | `echarts-for-react` | Dashboard, Live Telemetry, Drift, Trends, Qubits, Topology |
| Tables | `.custom-table` + `useTableKit.js` | Inventory, jobs |
| Theme | `components/ui/ThemeProvider.jsx` | light/dark class on root |
| Loading | `components/ui/Skeleton.jsx` | Boneyard layouts |

**No** global state store (Redux/Zustand) — page-local `useState` + polling intervals.

---

## 5. Global shell and navigation audit

| Element | Path | Finding |
|---------|------|---------|
| Sidebar | `App.jsx` + `index.css` `.sidebar` | Fixed 260px; Observe/Execute/Record groups — good IA skeleton |
| Top bar | `.top-bar` | Only **topic** title (`Dashboard`, `Telemetry`) — **no** sub-route title, breadcrumbs, or task subtitle |
| Sub-nav tabs | `.tab-header` in `App.jsx` | 3–10 tabs per topic; **not reflected in URL** for some inner state (e.g. backend details tab strip vs URL) |
| Provenance | `DataProvenanceBar.jsx` | Useful but **easy to miss**; no link to docs; no per-page override |
| Clock + theme | Top bar | Decorative; no data freshness SLA |
| Skip link | `App.jsx` | Present — good |
| Alert badge | Sidebar | Shows count (100) — **overwhelming** without triage preview in shell |

**Problem:** User loses context — “Telemetry” does not say “Drift Analysis · IBM Brisbane · 24h”.

**Direction:** `PageHeader` with breadcrumb (`Observe › Telemetry › Drift`), optional `BackendContextSelector`, `TimeRangeSelector` (shared with P2 window util).

---

## 6. Visual design audit (generic / AI-dashboard signals)

Repeated patterns across `DashboardHome`, `OperationsCentre`, `PlatformHealth`, `AlertsEvents`:

1. **Five-up KPI card row** (`.grid-summary` + `.card`) with icon, big number, vague subtitle (“Multi-Modality Array”).
2. **Rounded white cards** with identical padding (`index.css` `.card` 10–12px).
3. **Lucide icons** as decoration without tying to drill-down.
4. **Badge vocabulary overload** — `badge-healthy`, `badge-warning`, `LIVE ·`, `OPTIMAL`, `FRESH` — same visual weight for different semantics.
5. **Inline monospace / Greek** in user-facing headers (`Health vector H = [...]`, `η_cal`).
6. **Marketing tone on ops pages** — login/landing copy style differs from console, but console still uses hype subtitles.

**Purposeful alternative:** Panel-based layout (title, description `(i)`, last-updated, actions), severity-first color only for exceptions, typography scale for **numbers that drive decisions**.

---

## 7. Whitespace and information-density audit

### Global

- `.page-container` padding `12px 16px` — reasonable; **content does not use full width** on 1440px+ (no max-width constraint — issue is **short charts** and **single-column stacks**, not excessive horizontal margin).
- `.grid-summary` `minmax(100px, 1fr)` — KPI cards **stretch wide** with tiny text — wasted horizontal space inside each card.

### Dashboard (`DashboardHome.jsx` + CSS)

| Area | Issue | Evidence |
|------|-------|----------|
| T1/T2 chart | `height: 180` fixed | Large card, small plot — screenshot `01-dashboard-light-*` |
| Alert list | Max 6 items, no severity grouping | 100 alerts → user must navigate away |
| Below fold | Full backend table duplicates Inventory | Redundant |
| Modality KPI strip | Text-only | Could be sparkline or status board |

**Above the fold should show:** Exception count by severity, worst backend, stale calibration count, collector failures, queue pressure — **actionable**, not five equal KPIs.

### Resource Health (`ResourceHealth.jsx`)

- Hero card = **paragraph + 12 badges** — consumes viewport before any backend row.
- Per-backend cards repeat 4 mini-tiles + counts line — **good data**, poor hierarchy.

### Operations Centre

- Duplicates dashboard KPI pattern without exception-first layout.

**Density recommendation:** Introduce **`data-density: compact | comfortable`** (CSS class on `.page-container`) — tighter table rows, smaller card padding, taller charts (min 280px), optional two-column desktop grids — **not** uniform shrink.

---

## 8. Content-depth audit (selected pages)

| Page | What user gets today | Missing (data-backed) |
|------|----------------------|------------------------|
| Dashboard | KPIs, 1 chart, 6 alerts, backend table | Fleet timeline, calibration histogram, job failure rate, collector health strip, **layout picker** |
| Operations | KPIs, platform badges, federated table | Exception queue, assigned incidents, “what changed in 24h” |
| Backend Details | Tabs, qubit grid | Sparkline per backend for T1; compare to fleet median |
| Live Telemetry | SSE chart + log | Staleness age, stream kind banner (partially in API) |
| Drift | Chart + table | Interpretation panel, affected job links |
| Queues | Counts | Wait-time distribution (if API provides `estimated_wait_time` — dashboard uses it; queue page should chart) |
| Reports | Export buttons | Preview manifest, provenance summary |
| Admin | Credentials, rules | Grouped settings; **fix stale path** `backend/app/core/mock_data.py` in UI copy |

---

## 9. Dashboard analysis (current)

**Data sources (verified in `DashboardHome.jsx`):** `getSummary`, `getBackends`, `getAlerts`, `getJobs`, `getQueues`, `getCalibrations`, `getCoherence`, `getConfigStatus` — refresh **8s**.

**Widgets today:**

1. Five KPI cards  
2. Modality coherence strip (conditional)  
3. T1/T2 horizontal bar chart (per backend)  
4. Active alerts list (6)  
5. Backend availability table  

**Gaps:** No time range control, no user widget selection, no link from chart bar → backend details, no “mock vs live” on KPI cards (only platform bar).

---

## 10. Three dashboard layout concepts

### Concept A — Operations-first (default for Operator role)

| Section | Content | Data |
|---------|---------|------|
| Row 1 | Critical alerts, open incidents, RED router backends, collector DLQ count | `/alerts`, `/incidents`, `/health/vector`, `/admin/collector-dlq` |
| Row 2 | Exception table (sortable) | alerts + health |
| Row 3 | Queue pressure + stale calibration | `/queues`, `/calibration` |
| Row 4 | Recent ops timeline | `/operations/timeline` API |

**Persona:** Facility operator. **Limitation:** Needs aggregation endpoint or parallel fetch (already pattern in dashboard).

### Concept B — Fleet intelligence (default for Researcher / leadership)

| Section | Content | Data |
|---------|---------|------|
| Row 1 | Modality mix, online/offline trend | `/backends`, time series — **needs** `/metrics/history` or stored snapshots |
| Row 2 | T1/T2 by backend (existing chart) + calibration freshness histogram | `/coherence`, `/calibration` |
| Row 3 | Compare backends shortcut | `/health/compare` |
| Row 4 | Utilization / jobs completed trend | `/jobs` history — **partial** (list only; trend may need backend aggregation) |

**Persona:** Program office. **Gap:** Historical fleet trends need backend rollups (P2+ data platform).

### Concept C — Technical observability (SRE / Admin)

| Section | Content | Data |
|---------|---------|------|
| Row 1 | Provenance + collector circuit + DB | `/admin/provenance`, `/admin/collector-health`, platform health |
| Row 2 | Metric coverage gaps | `/metrics/registry` |
| Row 3 | Adapter verification summary | `/admin/adapters/verification` |
| Row 4 | SSE stream health | SSE metadata in stream + platform health |

**Persona:** Platform engineer. **Feasible now** with existing admin APIs.

**Customization:** Store `dashboard_layout` + `widgets[]` in user prefs (DB `user_accounts` exists — P4) or `localStorage` MVP.

---

## 11. Chart portfolio (purpose-mapped)

| Chart | Question | Source | Feasible now? | Type |
|-------|----------|--------|---------------|------|
| Fleet T1/T2 by backend | Who is degraded? | `GET /coherence` | Yes | Bar (exists) |
| T1 trend per backend | Drifting? | qubit history / drift APIs | Partial | Line |
| Calibration freshness | What needs cal run? | `/calibration` | Yes | Histogram / status board |
| Active alerts over time | Getting worse? | SSE / replay | Partial | Line |
| Queue depth + wait | Pressure? | `/queues` | Yes | Bar + secondary axis |
| Job outcomes | Failure rate? | `/jobs` | Partial (needs bucketing) | Stacked bar |
| Collector success | Ingest healthy? | admin collector health | Yes | Stat + sparkline |
| Anomaly timeline | When did it start? | `/anomalies` | Yes | Timeline |
| Modality comparison | Safe compare? | compare API + guards | Yes | Small multiples |
| Environment severity | Facility impact? | `/environment` | Yes | Band / timeline |

Avoid chart filler — each panel needs **title + (i) description + drill-down**.

---

## 12. Page-by-page audit (summary matrix)

Full matrix: **§21**. Condensed findings:

| Page | File | Top problems |
|------|------|--------------|
| Landing | `LandingPage.jsx` | Marketing-heavy; OK for public |
| Login/Register | `LoginPage.jsx` | Long page; captcha friction; dual marketing footer |
| Dashboard | `DashboardHome.jsx` | One chart; KPI sprawl; alert overload |
| Operations | `OperationsCentre.jsx` | KPI clone; badge providers |
| Platform health | `PlatformHealth.jsx` | Text-heavy cards |
| Backend inventory | `BackendInventory.jsx` | Table OK; no fleet map |
| Backend details | `BackendDetails.jsx` | Many tabs; weak time context |
| Qubit monitoring | `QubitMonitoring.jsx` | Chart + table; large systems untested visually |
| Live telemetry | `LiveTelemetry.jsx` | “Live” needs stream kind callout in page body |
| Calibration / drift / trends | respective pages | Similar card+chart pattern; window control only on some |
| Topology | `TopologyExplorer.jsx` | ECharts graph — usability depends on qubit count |
| Jobs / queues | `JobMonitoring.jsx` | Filters improved; queue lacks distribution viz |
| **Resource health** | `ResourceHealth.jsx` | **Badge soup; formula wall; weak tooltips** |
| Environment | `EnvironmentPage.jsx` | Honest NOT_BUILT copy — good; table sparse |
| Metrics | `MetricsCoverage.jsx` | Duplicated route (telemetry + resources) |
| Alerts / incidents | `AlertsEvents.jsx` | Large tables; workflow dense |
| Reports | `ReportsPage.jsx` | Export-first; little preview |
| Admin | `AdministrationPage.jsx` | Truth labels good; modal a11y deferred |

---

## 13. Page-by-page redesign specifications (high priority)

### Dashboard (`DashboardHome.jsx`, `DashboardHome.css`)

- Replace fixed `180px` chart with **`min-height: clamp(240px, 32vh, 420px)`**.
- Add **layout selector** (A/B/C) storing widget visibility.
- Add second row: **queue + calibration freshness** charts side-by-side.
- KPI row: reduce to **4** or merge Jobs/Queue; add **sparklines** if history API available.
- Alert column: group by severity; link each row to alert detail / backend.

### Resource Health (`ResourceHealth.jsx`)

- Move `Health vector H = ...` to **“Health model” drawer** opened from `(i)` next to page title.
- Replace module badge row with **compact table**: Module | Status | Scope | `(i)` — reference `GET /health/modules` descriptions.
- Per metric tile (`F_limit`, …): **`InfoLabel`** with definition, unit, source field.
- Keep advisory quarantine CTA but add **impact summary** (“N RED qubits across M backends”).

### Global tooltips (Cert Studio pattern)

- Add `components/InfoTooltip.jsx`: `button.info-trigger` + `role="tooltip"` popover on hover/focus; keyboard Esc dismiss.
- Use on: health metrics, LIVE/STUB badges, provenance terms, compare guards, drift thresholds.

---

## 14. Table and visualization audit

| Table | Question | Better alternative? |
|-------|----------|---------------------|
| Dashboard backends | Fleet status | Master-detail with map/list split |
| Health qubits | Which to quarantine? | Heatmap by router state + filter |
| Jobs | What failed? | Keep table; add failure facet chart |
| Alerts 100 rows | What first? | **Exception board** by severity + backend |
| Metrics coverage | What's missing? | Matrix provider × metric (heatmap) |

`useTableKit` — reuse; add optional virtualization for 100+ alerts.

---

## 15. Interaction audit (samples)

| ID | Component | Issue | Expected |
|----|-----------|-------|----------|
| IX-01 | `App.jsx` tabs | Telemetry has 10 tabs — horizontal scroll only | Tab overflow menu or secondary sidebar |
| IX-02 | Dashboard KPI cards | Only Alerts/Jobs navigate | All KPIs drill-down |
| IX-03 | `ResourceHealth` | `title=` on badges — no keyboard access | InfoTooltip |
| IX-04 | Admin modal | Focus trap deferred | Trap + return focus |
| IX-05 | Charts | No click → backend | `onEvents` drill-down |
| IX-06 | Filters | Some pages lack visible filter effect | Show “N results” delta |

---

## 16. Accessibility audit (WCAG 2.2 AA baseline — review)

| Area | Status | Notes |
|------|--------|-------|
| Skip link | Pass | `App.jsx` |
| Focus visible | Partial | `:focus-visible` in CSS |
| Heading hierarchy | **Fail** | Page h1 in top bar; pages use h3 without h2 |
| Tooltips | **Fail** | Mostly `title` — not accessible |
| Modals | **Fail** | Admin dialog — no trap |
| Charts | **Fail** | No textual summary / data table toggle |
| Color-only status | Partial | Badges include text |
| Live regions | Partial | Provenance `aria-live="polite"` only |

**Not claimed:** formal compliance — axe run required.

---

## 17. Responsive / large-screen audit

| Viewport | Observation |
|----------|-------------|
| 1440×900 | Under-used width; charts short |
| 768×1024 | Sidebar + content tight; tabs scroll (`01-dashboard-tablet-768.png`) |
| NOC / 4K | No multi-column dashboard |
| Mobile phone | **Not captured** — side nav likely unusable without drawer |

**Recommendation:** Desktop-first ops; mobile = read-only alerts acknowledge (future).

---

## 18. Data honesty and trust audit

| Surface | Honest? | Fix |
|---------|---------|-----|
| `DataProvenanceBar` | Good platform-level | Per-widget source chips |
| Dashboard “live qubits” | Overstates | Rename “DB snapshot coherence” |
| Resource Health module badges | Accurate but noisy | Table + glossary |
| Live Telemetry SSE | Improved | Page subtitle from `stream_kind` |
| Admin mock path text | **Misleading path** | Point to `app/core/mock_data.py` |

Labels to standardize: **Live · Simulated · Mock catalog · Cached · Stale · Partial · Unsupported · Unknown · Error · NOT_BUILT**.

---

## 19. Design system audit

**Strengths:** CSS variables light/dark; consistent `.btn`, `.badge`, `.card`.

**Gaps:**

- No spacing scale documentation (mixed inline `style={{ gap: 12 }}`).
- No `InfoTooltip`, `PageHeader`, `ChartPanel`, `StatCard`.
- Dark mode: some pages hardcode `#ffffff` tooltips (`HistoricalTrends.jsx`).
- Table hover `#f8fafc` ignores dark (`.custom-table tr:hover`).

**Tokens to add:** `--density-compact`, `--chart-min-h`, `--panel-gap`, semantic `--status-*`.

---

## 20. Shared component recommendations

| Component | Action | Pages |
|-----------|--------|-------|
| `PageHeader` | **Create** | All |
| `InfoTooltip` / `GlossaryPopover` | **Create** | Health, Admin, Compare, Drift |
| `ChartPanel` | **Create** | Dashboard, telemetry |
| `MetricCard` (+ optional sparkline) | **Create** | Dashboard, Ops |
| `TimeRangeSelector` | **Extend** `TelemetryWindowControl.jsx` | Dashboard, drift, trends |
| `BackendContextSelector` | **Create** | Telemetry, details |
| `DataSourceBadge` | **Create** | All KPIs |
| `ExceptionList` | **Create** | Dashboard, Ops |
| `EmptyState` / `ErrorState` | **Consolidate** | Many ad-hoc divs |
| `DetailDrawer` | **Create** | Alerts, backends |

---

## 21. Frontend implementation mapping

| Page component | CSS | APIs (primary) |
|----------------|-----|----------------|
| `DashboardHome.jsx` | `DashboardHome.css` | summary, coherence, alerts, jobs, queues, calibrations |
| `OperationsCentre.jsx` | inline | operations centre, federated |
| `PlatformHealth.jsx` | inline | platform health |
| `ResourceHealth.jsx` | inline | `/health/vector`, `/health/modules`, explain |
| `LiveTelemetry.jsx` | inline | SSE `/events/stream` |
| `BackendInventory.jsx` | `BackendInventory.css` | `/backends` |
| `BackendDetails.jsx` | `BackendDetails.css` | backend bundle |
| `JobMonitoring.jsx` | `JobMonitoring.css` | `/jobs` |
| `AlertsEvents.jsx` | `AlertsEvents.css` | alerts, incidents |
| `AdministrationPage.jsx` | `AdministrationPage.css` | admin/* |
| `MetricsCoverage.jsx` | — | `/metrics/*` |

Reuse: `useTableKit`, `BoneyardSkeleton`, `DataProvenanceBar`, `formatISTTime`, ECharts theme helpers (extract from duplicated chart option blocks).

---

## 22. External design research (verified references)

| Source | Pattern | Apply to Q-TeleScope |
|--------|---------|----------------------|
| [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) | Purpose-driven dashboards, document panels, avoid chart junk | Panel descriptions via InfoTooltip; limit refresh |
| [Grafana visual hierarchy blog](https://grafana.com/blog/getting-started-with-grafana-best-practices-to-design-your-first-dashboard/) | Z-pattern, size/color hierarchy | Exceptions top-left; enlarge critical stats |
| [Grafana dashboard groupings](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-groupings/) | Rows/tabs for sections | Dashboard layouts A/B/C as tabs |
| [Grafana time series panel](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/time-series/) | Time range, dual axis discipline | Live telemetry + trends pages |
| [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) | Tooltip accessibility, contrast | Replace `title`-only help |

**Not copied:** Grafana UI skin — adopt **information architecture** only.

---

## 23. Prioritized issue register

| ID | Page/component | Problem | Evidence | User impact | Recommendation | Pri | Files | Acceptance |
|----|----------------|---------|----------|-------------|----------------|-----|-------|------------|
| UX-001 | `DashboardHome.jsx` | Single primary chart | Screenshot 01-* | Weak situational awareness | Multi-panel grid + layout picker | P1 | Dashboard* | ≥3 charts user-toggle |
| UX-002 | `DashboardHome.jsx` | Chart height 180px | L250-257 | Wasted space | Responsive min-height | P1 | Dashboard* | Chart fills card |
| UX-003 | `ResourceHealth.jsx` | Module badge soup | Screenshot 22-* | Sloppy / unreadable | Status table + glossary | P0 | ResourceHealth | ≤1 row summary + table |
| UX-004 | `ResourceHealth.jsx` | Formula wall in header | L77-81 | Cognitive load | Move to help drawer | P1 | ResourceHealth | Header ≤2 lines |
| UX-005 | Global | No Cert Studio-style tooltips | Grep tooltips | Users don’t understand metrics | `InfoTooltip` component | P1 | new + Health, Admin | Keyboard + hover |
| UX-006 | `App.jsx` top bar | No breadcrumbs/subtitle | Runtime | Lost context | `PageHeader` | P1 | App.jsx | Shows route + backend |
| UX-007 | Dashboard KPI | Vague subtitles | UI copy | Generic feel | Task-oriented labels + drill-down | P2 | DashboardHome | Each KPI links |
| UX-008 | Dashboard | 100 alerts, show 6 | data | Alert fatigue | Severity groups + “top 5 critical” | P1 | DashboardHome | Critical visible |
| UX-009 | `OperationsCentre.jsx` | Duplicates dashboard KPIs | Screenshot 04-* | Redundant navigation | Exception-first layout | P2 | OperationsCentre | No duplicate KPI set |
| UX-010 | `index.css` `.grid-summary` | Cards stretch empty | CSS | Low density | Max-width per card or more columns | P2 | index.css | KPI grid 5-col desktop |
| UX-011 | `LiveTelemetry.jsx` | “Live” semantics | SSE docs | Trust | Stream kind banner in page | P1 | LiveTelemetry | Shows refresh interval |
| UX-012 | `AdministrationPage.jsx` | Wrong mock_data path | L265 area | Credibility | Fix path to `app/` | P1 | AdministrationPage | Correct path |
| UX-013 | Charts (multiple) | Hardcoded light tooltip | HistoricalTrends | Dark mode broken | Shared chart theme util | P2 | telemetry pages | Dark tooltips |
| UX-014 | `.custom-table` | Hover light-only | index.css | Dark mode UX | Use CSS variables | P2 | index.css | Dark hover |
| UX-015 | `AdministrationPage.jsx` | Modal focus trap missing | WORKLOG defer | a11y | Focus trap | P1 | Admin modal | Tab cycles in modal |
| UX-016 | Headings | h1 then h3 skip h2 | App + pages | SR navigation | Semantic levels | P2 | all pages | Valid outline |
| UX-017 | `MetricsCoverage.jsx` | Duplicate nav targets | appNav | Confusion | Single canonical route | P3 | App.jsx | One menu entry |
| UX-018 | Dashboard | No time range | — | Can’t correlate | TimeRange on dashboard | P2 | Dashboard + API | Range affects widgets |
| UX-019 | Backend table | Duplicates inventory | Dashboard | Scroll waste | Link “View inventory” | P3 | DashboardHome | Optional collapse |
| UX-020 | `ResourceHealth.jsx` | `title=` only for why | L174 | No keyboard help | InfoTooltip on Why column | P1 | ResourceHealth | Focusable help |
| UX-021 | Login | Captcha + marketing length | Screenshot 02-* | Friction | Shorter auth layout | P2 | LoginPage | — |
| UX-022 | Mobile | Sidebar fixed 260px | CSS | Unusable | Collapse to drawer | P2 | index.css | 390px usable |
| UX-023 | ECharts | No drill-down | Dashboard | Slow investigation | click → backend | P2 | DashboardHome | Click bar navigates |
| UX-024 | Provenance bar | Detached from widgets | — | Unclear metric source | Per-panel source | P2 | DataProvenanceBar | Chip on charts |
| UX-025 | Compare page | Technical guardrails hidden | BackendComparison | Mis-compare risk | Explain modality guard UI | P1 | BackendComparison | Visible guard message |
| UX-026 | Reports | No preview | ReportsPage | Export anxiety | Manifest preview | P2 | ReportsPage | Shows contents |
| UX-027 | Queues | Counts only | QueueMonitoring | No ops insight | Wait histogram | P2 | QueueMonitoring + API | Chart if data exists |
| UX-028 | Global | Inline styles predominate | pages | Hard to theme | Migrate key layouts to CSS | P3 | pages | — |
| UX-029 | Alert sidebar badge | 100 no context | App.jsx | Stress | Show critical-only badge | P2 | App.jsx | Split badge counts |
| UX-030 | Federation UI | Table without story | OperationsCentre | Unclear national view | Snapshot provenance panel | P3 | OperationsCentre | — |

---

## 24. Page redesign matrix

| Page | Current purpose | Current problems | Recommended layout | Useful content to add | Viz options | Interactions | a11y | Backend/data |
|------|-----------------|------------------|--------------------|-----------------------|-------------|--------------|------|--------------|
| Dashboard | Fleet snapshot | 1 chart, gaps, alert noise | A/B/C layout grid | Collector health, cal histogram, job failures | Multi time-series, stat panels | Layout save, drill-down | Chart data table alt | Existing APIs + some rollups |
| Operations | Operator hub | KPI clone | Exception board + timeline | Assigned incidents | Timeline, status board | One-click to incidents | Landmark regions | operations API |
| Resource Health | Advisory router | Badge soup, formula wall | Summary strip + backend accordions | Model glossary | Heatmap optional | InfoTooltips | Tooltips accessible | health APIs ✓ |
| Live Telemetry | SSE watch | Stream honesty buried | Chart + event log split | Staleness, stream metadata | Line (exists) | Pause stream | Live region polite | SSE ✓ |
| Backend Details | Deep dive | Tab overload | Left profile + right tab content | Sparklines | Qubit grid (exists) | Link to jobs/incidents | Tab roles | backend APIs ✓ |
| Backend Inventory | Fleet list | Table only | Split filter + table + mini map | Freshness column chart | Status strip | Compare select | Sortable headers | backends ✓ |
| Qubit Monitoring | Qubit metrics | Density on 108Q | Virtualized grid | Export selection | Bar chart (exists) | Search/filter | — | qubits API |
| Calibration Status | Freshness | Card grid sparse | Table + histogram | Age buckets | Histogram | Filter stale | — | calibration ✓ |
| Drift Analysis | Drift view | Chart without narrative | Chart + interpretation panel | Threshold docs | Line (exists) | Time window (exists) | — | drift API ✓ |
| Historical Trends | Long-term | Dark tooltip bug | Dual chart + legend | Downsample note | Line | Metric picker | Contrast fix | history API |
| Topology Explorer | Graph | Scale unknown | Full-width graph + search | Gate props panel | Graph | Node click | Keyboard graph partial | topology API |
| Calibration Timeline | Events | — | Timeline + list | Provenance | Timeline (exists) | Zoom range | — | timeline API |
| Backend Comparison | Safe compare | Guards subtle | Side-by-side cards | Modality warning banner | Table | Pick backends | Explain guards | compare API ✓ |
| Anomaly Monitor | Anomalies | Table-heavy | Severity queue + detail | Link telemetry | Timeline | Open incident | — | anomalies API |
| Temporal Replay | Replay | — | Scrubber + chart | Frame inspect | Line/scrubber | Play/pause | — | replay API |
| Job Monitoring | Jobs | Good filters | Keep + failure chart | Category breakdown | Bar/pie | Row → backend | — | jobs ✓ |
| Queue Monitoring | Queues | Shallow | Queue cards + wait dist | Backend context | Histogram | — | — | queues ✓ |
| Environment | Import facility data | Sparse table | Import wizard + quality panel | Validation errors | Table | Upload | — | environment API ✓ |
| Metrics Coverage | Coverage | Duplicate route | Provider × metric matrix | STUB vs LIVE | Heatmap | Cell drill-down | — | metrics registry ✓ |
| Alerts | Triage | 100 rows | Filter + severity board | Correlation hints | List/board | Ack/assign | — | alerts ✓ |
| Incidents | Workflow | Dense | Timeline-first detail | Evidence links | Timeline | Status transitions | — | incidents API ✓ |
| Reports | Evidence export | No preview | Split preview + actions | Provenance | List | Download auth | — | reports API ✓ |
| Administration | Config | Long page | Grouped sections | Test connection | Cards | Modal rules | Focus trap | admin APIs ✓ |
| Platform Health | SRE view | Text cards | Panel grid | DLQ peek | Stat panels | Refresh | — | health APIs ✓ |
| Ops Timeline | Audit narrative | Table | Vertical timeline | Actor + resource | Timeline | Filter | — | audit/timeline |
| Landing | Marketing | — | Keep | — | — | — | — | — |
| Login/Register | Auth | Long | Compact center card | — | — | Captcha | Label fields | auth API |

---

## 25. Proposed redesign roadmap (post-approval)

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| R0 | Trust + clarity | InfoTooltip, health page cleanup, dashboard chart height, mock path fix |
| R1 | Dashboard | Layouts A/B/C (localStorage MVP), 3+ panels, drill-down |
| R2 | Shell | PageHeader, breadcrumbs, backend/time context |
| R3 | Density + dark polish | Compact mode, chart theme util, table dark hover |
| R4 | a11y | axe gate, modal trap, chart fallbacks |
| R5 | E2E | Playwright flows operator + dashboard layouts |

---

## 26. Acceptance criteria (redesign sign-off)

- Dashboard offers **≥3 selectable layouts** with **≥3 charts/panels** on default layout (data-backed).
- Resource Health: **no module badge row**; glossary via InfoTooltip; header ≤2 lines visible.
- **Zero** critical axe violations on Dashboard, Login, Operations (automated CI).
- Every KPI/chart shows **source + as-of** (live/sim/mock/stale).
- Operator can reach incident from dashboard exception widget in **≤2 clicks**.
- Desktop 1440px: primary chart uses **≥30% viewport height** or user-configured height.

---

## 27. Questions for user / C-DAC

1. Default dashboard persona: **Operator (A)** vs **Fleet (B)** vs **SRE (C)**?
2. Is **dashboard layout persistence** per-user (DB) required for pilot?
3. Cert Studio tooltip reference: **hover-only** or **click-to-pin** for long health definitions?
4. Mobile scope: **read-only alerts** in scope or desktop-only for year 1?
5. Accept **collapsing duplicate** dashboard backend table into inventory link?

---

## 28. Evidence appendix

### A. Component-level example (Resource Health module badges)

```77:93:frontend/src/pages/ResourceHealth.jsx
            <div style={{ fontWeight: 700 }}>Health vector H = [F_limit, η_cal, δ_cal, C_exec]</div>
            ...
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {modules.map((m) => (
            <span key={m.id} className={`badge ...`} title={m.name}>
              {m.status} · {m.id.replaceAll('_', ' ')}
            </span>
          ))}
```

### B. Dashboard single chart constraint

```250:257:frontend/src/pages/DashboardHome.jsx
          <div className="dashboard-chart-container">
            ...
              <ReactECharts option={coherenceOption} style={{ height: 180, width: '100%' }} autoResize notMerge />
```

### C. Tooltip usage (insufficient pattern)

Only isolated `title=` attributes — e.g. `JobMonitoring.jsx`, `ResourceHealth.jsx`; no shared accessible tooltip component.

### D. Screenshot paths

All under `audit/frontend-screenshots/2026-10-31/*.png` — see INVENTORY.md.

---

## 29. Audit brief coverage checklist

Cross-check against the requested audit scope (analysis-only):

| Requested section | Report section | Notes |
|-------------------|----------------|-------|
| Product context | §1, §12 | |
| Running app + screenshots | §2–3, INVENTORY | 31 PNGs; login captcha path not shot |
| Component-level element tables | §13, §28 | **Per-element tables omitted** (would 3× doc size); matrix + code cites cover top issues |
| §4.1 AI/generic appearance | §6 | |
| §4.2 Whitespace / density | §7 | |
| §4.3 Content depth | §8, §12 | |
| Dashboard + 3 concepts | §9–10 | |
| Chart portfolio | §11 | |
| Every page questions | §12, §24 matrix | All routed pages included |
| Table vs viz audit | §14 | |
| Visual hierarchy / composition | §6–7 | Wireframes: text layout in §10 |
| Interaction audit | §15 | |
| Accessibility WCAG 2.2 | §16 | No axe run |
| Responsive / NOC | §17 | Phone not shot |
| Data honesty | §18 | |
| Design system | §19 | |
| Shared components | §20 | |
| Implementation mapping | §21 | |
| External research | §22 | Official Grafana + WCAG |
| Issue register | §23 | 30 rows |
| Page redesign matrix | §24 | All pages |
| Roadmap + acceptance + questions | §25–27 | |
| Evidence appendix | §28 | |
| No implementation | ✓ | No `frontend/src` changes |

**End of audit — await review before implementation.**
