# Q-TeleScope — Route and Context Map

**Current routing:** React Router `main.jsx` + in-app state sync `appNav.js` (`buildAppPath` / `parseAppPath`)  
**Default backend:** `ibm_brisbane` (`appNav.js`)

## Proposed query parameters (global)

| Parameter | Purpose | Scope |
| --------- | ------- | ----- |
| `backendId` | Selected backend | Analyze, Investigate, Execute filters, Workspace |
| `from`, `to` | ISO8601 window | Trends, drift, replay, timeline |
| `metric` | t1, t2, readout_error, etc. | Drift, anomalies, charts |
| `alertId` | Alert detail / investigation | Records → Analyze |
| `incidentId` | Incident context | Records → Timeline |
| `jobId` | Job detail | Execute |
| `qubitId` | Qubit index | Workspace qubits, health |

**Rule:** URL wins over React state; `appNav.js` extended, not parallel hidden state.

---

## Route mapping table

| Current route | Current component | Proposed route | Redirect? | Context to preserve | Reason |
| ------------- | ----------------- | -------------- | --------- | ------------------- | ------ |
| `/` | LandingPage | `/` | No | — | Public |
| `/login` | LoginPage | `/login` | No | — | Auth |
| `/register` | RegisterPage | `/register` | No | — | Auth |
| `/app` | DashboardHome | `/app/overview` | **Yes** `/app` → overview | — | Distinct fleet overview |
| `/app/operations` | OperationsCentre | `/app/operate` | **Yes** | — | Operator queue vs analytics |
| `/app/operations/health` | PlatformHealth | `/app/platform/health` | **Yes** | — | Platform ≠ quantum health |
| `/app/operations/timeline` | OpsTimeline | `/app/investigate/timeline` | **Yes** | `backendId`, `from`, `to` | Investigation group |
| `/app/backends/inventory` | BackendInventory | `/app/fleet` | **Yes** | filters in query optional | Registry naming |
| `/app/backends/qubits` | QubitMonitoring | `/app/fleet/qubits` **or** workspace tab only | **Yes** → fleet qubits or redirect with `backendId` | `backendId`, `qubitId` | Consolidate |
| `/app/backends/details/{id}` | BackendDetails | `/app/fleet/{backendId}` + `/app/fleet/{backendId}/{tab}` | **Yes** | `backendId`, tab, `from`, `to` | Workspace |
| `/app/telemetry/live` | LiveTelemetry | `/app/analyze/live` | **Yes** | `backendId`, `metric` | Analyze group |
| `/app/telemetry/calibration` | CalibrationStatus | `/app/analyze/calibration` | **Yes** | `backendId` | |
| `/app/telemetry/cal-timeline` | CalibrationTimeline | `/app/analyze/calibration/timeline` | **Yes** | `backendId`, window | Nested cal |
| `/app/telemetry/drift` | DriftAnalysis | `/app/analyze/drift` | **Yes** | `backendId`, `metric`, `qubitId` | |
| `/app/telemetry/trends` | HistoricalTrends | `/app/analyze/trends` | **Yes** | `backendId`, `from`, `to` | |
| `/app/telemetry/topology` | TopologyExplorer | `/app/analyze/topology` | **Yes** | `backendId` | |
| `/app/telemetry/compare` | BackendComparison | `/app/analyze/compare` | **Yes** | selected backends in query | |
| `/app/telemetry/anomalies` | AnomalyMonitor | `/app/investigate/anomalies` | **Yes** | `metric`, `backendId` | Investigate |
| `/app/telemetry/replay` | TemporalReplay | `/app/investigate/replay` | **Yes** | `backendId`, frame index optional | |
| `/app/telemetry/metrics` | MetricsCoverage | `/app/analyze/coverage` | **Yes** | `backendId` | Canonical |
| `/app/resources/metrics` | MetricsCoverage (duplicate) | → `/app/analyze/coverage` | **Yes** mandatory | — | Remove duplicate |
| `/app/execution/jobs` | JobMonitoring | `/app/execute/jobs` | **Yes** | `backendId`, status filters | |
| `/app/execution/queues` | QueueMonitoring | `/app/execute/queues` | **Yes** | `backendId` | |
| `/app/resources/health` | ResourceHealth | `/app/resources/health` | Optional alias only | — | Name OK |
| `/app/resources/environment` | EnvironmentPage | `/app/resources/environment` | Optional alias | — | |
| `/app/alerts` | AlertsEvents (alerts) | `/app/record/alerts` | **Yes** | `status`, `severity`, `alertId` | Records |
| `/app/alerts/incidents` | AlertsEvents (incidents) | `/app/record/incidents` | **Yes** | `incidentId` | |
| `/app/reports` | ReportsPage | `/app/record/reports` | **Yes** | — | |
| `/app/admin` | AdministrationPage (monolith) | Split below | **Yes** `/app/admin` → hub or integrations | — | Split configure |

### Configure split (proposed)

| Proposed route | Content from `AdministrationPage.jsx` |
| -------------- | ------------------------------------- |
| `/app/configure/integrations` | Credentials, adapter verification, discovery |
| `/app/configure/collectors` | Schedules, DLQ, collector health links |
| `/app/configure/rules` | Alert rules + modal |
| `/app/configure/platform` | Env/mock strip, deployment profile, retention if present |

---

## Sidebar mapping (proposed)

| Group | Items |
| ----- | ----- |
| Overview | Fleet Overview, Operator Console |
| Fleet | Registry, (optional fleet-wide Qubits) |
| Analyze | Live, Trends, Calibration, Drift, Compare, Topology, Coverage |
| Investigate | Anomalies, Replay, Timeline |
| Execute | Jobs, Queues |
| Resources | Resource Health, Environment |
| Record | Alerts, Incidents, Reports |
| Platform | Platform Health |
| Configure | Integrations, Collectors, Rules, Platform (admin role) |

---

## Investigation chain (deep links)

```
/app/record/alerts?alertId={id}&backendId={b}
  → /app/investigate/timeline?from={detected-1h}&to={detected+1h}&backendId={b}
  → /app/fleet/{b}/telemetry?from=...&to=...
  → /app/fleet/{b}/qubits?qubitId={q}
  → /app/record/reports (createEvidenceSnapshot)
```

**Feasibility:** Alert `detected_at` in API (`AlertResponse`) — `FEASIBLE_NOW`; wire in FE — `FRONTEND_CHANGE`.

---

## Implementation notes

- Extend `parseAppPath` / `buildAppPath` for new path prefixes; keep legacy paths as redirect routes in `main.jsx` or shell `useEffect` navigate.
- Backend workspace tabs: `/app/fleet/:backendId/:tab` where `tab` ∈ `summary|telemetry|qubits|calibration|jobs|queues|health|topology`.
- Do **not** break `selectedBackendId` until redirects tested.
