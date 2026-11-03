# Q-TeleScope — Prioritized Implementation Roadmap

**Principle:** Small phases, testable, no big-bang rewrite. Preserve provider adapters, evidence APIs, existing deep links via redirects.

---

## P0 — Trust, structure, navigation

| Priority | Change | Pages affected | Dependencies | Acceptance criteria | Risk |
| -------- | ------ | -------------- | ------------ | ------------------- | ---- |
| P0.1 | **Alert semantics glossary + UI labels** | Dashboard, Operate, Alerts, sidebar | None | Every surface labels Critical vs Active; sidebar definition documented | Low |
| P0.2 | **Alerts default filter ACTIVE** | AlertsEvents | API | List defaults to ACTIVE; tab for all/history | Low |
| P0.3 | **ExceptionStrip shared component** | Dashboard, Operate | P0.1 | Same props contract; no duplicate markup | Low |
| P0.4 | **Fleet Overview slim** — remove redundant backend table widget; cap API fan-in | DashboardHome | Product sign-off | ≤8 data calls or batched; primary question answerable above fold | Med |
| P0.5 | **Operator Console** — action queue layout; no fleet analytics charts | OperationsCentre | P0.3 | Open incident/alert in ≤2 clicks | Med |
| P0.6 | **Metrics Coverage canonical** + redirect | App.jsx, MetricsCoverage | Route map | Only one nav entry; `/app/resources/metrics` redirects | Low |
| P0.7 | **Platform Health nav** move to Platform group | App.jsx, pageContext | Routes | No longer under Operations tabs | Low |
| P0.8 | **appNav redirects** (legacy → proposed) | appNav.js, main.jsx | Route map | Bookmarks to `/app/telemetry/live` still work | Med |
| P0.9 | **ProvenanceChip** on ChartPanel + key tables | Shared | DataProvenanceBar pattern | expandable source type | Low |
| P0.10 | **Admin split phase 1** — routes + extract Integrations + Rules (no behavior change) | AdministrationPage | Configure layout | `/app/admin` → hub; credentials+rules moved | Med |

**P0 exit gate:** `npm run build`; manual walk Operate + Dashboard + Alerts counts reconcile; pytest smoke if touched backend.

---

## P1 — Core operator workflows

| Priority | Change | Pages affected | Dependencies | Acceptance criteria | Risk |
| -------- | ------ | -------------- | ------------ | ------------------- | ---- |
| P1.1 | **ContextBar** + URL params | Analyze, Investigate, Execute | appNav | Changing backend updates URL; refresh preserves | Med |
| P1.2 | **Backend Workspace shell** + URL tabs | BackendDetails, App routing | P1.1 | Share URL opens same tab | High |
| P1.3 | **Consolidate qubits** into workspace | QubitMonitoring, workspace | P1.2 | Fleet-wide qubits optional redirect | Med |
| P1.4 | **Resource Health** copy/hierarchy (reference fold, advisory labels) | ResourceHealth | Done partially | Operators see actions before model | Low |
| P1.5 | **Investigation links** alert → timeline → fleet telemetry | Alerts, OpsTimeline, Live/Historical | P1.1, alert `detected_at` | One workflow demo’d end-to-end | Med |
| P1.6 | **Live Telemetry honesty banner** | LiveTelemetry | V6 verification | States SSE/platform refresh; not vendor push | Low |
| P1.7 | **Jobs/Queues** definitions tooltips + detail links | JobMonitoring, QueueMonitoring | — | Status glossary; row → workspace jobs | Low |
| P1.8 | **Environment NOT_BUILT banner** | EnvironmentPage | pageContext copy | No fake live cryo | Low |
| P1.9 | **Admin split phase 2** — Collectors + Platform settings + DLQ view | Admin | P0.10 | DLQ visible if API returns rows | Med |
| P1.10 | **Fleet Registry summary band** | BackendInventory | getBackends | Counts by status/modality | Low |

---

## P2 — Analysis capabilities

| Priority | Change | Pages affected | Dependencies | Acceptance criteria | Risk |
| -------- | ------ | -------------- | ------------ | ------------------- | ---- |
| P2.1 | Calibration age distribution (if API supports bins) | Calibration Status | Backend aggregation | No chart if data insufficient | Med |
| P2.2 | Queue wait histogram | QueueMonitoring | V4 schema | Empty if no timestamps | Med |
| P2.3 | Drift interpretation panel | DriftAnalysis | explain endpoints? | Method visible | Low |
| P2.4 | Topology EdgeTable | TopologyExplorer | — | WCAG alternative | Low |
| P2.5 | Anomaly row drill | AnomalyMonitor | P1.1 | Opens workspace qubit | Low |
| P2.6 | Reports manifest preview | ReportsPage | evidence API | User sees contents before export | Med |
| P2.7 | Fleet health history chart | Overview | **Backend time series** | Skip if API missing | High |

---

## P3 — Advanced usability

| Priority | Change | Pages affected | Dependencies | Acceptance criteria | Risk |
| -------- | ------ | -------------- | ------------ | ------------------- | ---- |
| P3.1 | Global search | Shell | New API | Defer if NOT_SUPPORTED | High |
| P3.2 | Saved views (filters + layout) | Overview, Analyze | User prefs | Extends usePageLayout | Med |
| P3.3 | Inventory sparklines | Fleet | Historical data | Optional | Med |
| P3.4 | Mobile nav drawer | App shell | CSS | 390px usable | Med |

---

## Suggested sprint mapping

| Sprint | Scope |
| ------ | ----- |
| A | P0.1–P0.3, P0.6 |
| B | P0.4–P0.5, P0.7–P0.9 |
| C | P0.8, P0.10, P1.1 |
| D | P1.2–P1.3, P1.5 |
| E | P1.4, P1.6–P1.10 |
| F+ | P2*, P3* |

---

## Do not do in early phases

- Circuit submission UI  
- 3D topology  
- Fake “real-time” labels without SSE/collector evidence  
- Broad CSS-only reshuffle without route/context work  
- Removing mock catalog without provenance labeling  
