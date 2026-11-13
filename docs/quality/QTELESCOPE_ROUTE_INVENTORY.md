# Q-TeleScope route inventory

Derived from `frontend/src/appNav.js`, `frontend/src/appLazyPages.js`, `frontend/src/App.jsx`.  
**Audit method:** static analysis + **browser evidence** (2026-11-10).  
**Rendered:** partial — see audit status column; screenshots in [ui-audit/](./ui-audit/).

| Route ID | Path | Page title (shell) | Component | Module | Lazy | Audit status |
| --- | --- | --- | --- | --- | --- | --- |
| home | `/app/overview` | Overview | `DashboardHome.jsx` | Observe | yes | Code only |
| operate | `/app/operate` | Operator console | `OperationsCentre.jsx` | Operations | yes | Code only |
| platform | `/app/platform/health` | Platform health | `PlatformHealth.jsx` | Platform | yes | Code only |
| timeline | `/app/investigate/timeline` | Ops timeline | `OpsTimeline.jsx` | Investigate | yes | Code only |
| backends-inv | `/app/backends/inventory` | Backend inventory | `BackendInventory.jsx` | Backends | yes | Code only |
| backends-qubits | `/app/backends/qubits` | Qubits | `BackendInventory.jsx` | Backends | yes | Legacy alias of inventory |
| backend-ws | `/app/backends/details/:id[/tab]` | Backend workspace | `BackendDetails.jsx` | Backends | yes | Code only |
| tel-live | `/app/telemetry/live` | Live telemetry | `LiveTelemetry.jsx` | Telemetry | yes | Code only |
| tel-cal | `/app/telemetry/calibration` | Calibration status | `CalibrationStatus.jsx` | Telemetry | yes | Code only |
| tel-drift | `/app/telemetry/drift` | Drift analysis | `DriftAnalysis.jsx` | Telemetry | yes | Code only |
| tel-trends | `/app/telemetry/trends` | Historical trends | `HistoricalTrends.jsx` | Telemetry | yes | Code only |
| tel-explorer | `/app/telemetry/explorer` | Metrics explorer | `MetricsExplorer.jsx` | Telemetry | yes | Code only |
| tel-topology | `/app/telemetry/topology` | Topology explorer | `TopologyExplorer.jsx` | Telemetry | yes | Code only |
| tel-cal-tl | `/app/telemetry/cal-timeline` | Calibration timeline | `CalibrationTimeline.jsx` | Telemetry | yes | Code only |
| tel-compare | `/app/telemetry/compare` | Backend comparison | `BackendComparison.jsx` | Telemetry | yes | Code only |
| tel-anom | `/app/telemetry/anomalies` | Anomaly monitor | `AnomalyMonitor.jsx` | Telemetry | yes | Code only |
| tel-replay | `/app/telemetry/replay` | Temporal replay | `TemporalReplay.jsx` | Telemetry | yes | Code only |
| tel-metrics | `/app/telemetry/metrics` | Metrics coverage | `MetricsCoverage.jsx` | Telemetry | yes | Code only |
| exec-jobs | `/app/execution/jobs` | Job monitoring | `JobMonitoring.jsx` | Execution | yes | Code only |
| exec-queues | `/app/execution/queues` | Queue monitoring | `QueueMonitoring.jsx` | Execution | yes | Code only |
| res-health | `/app/resources/health` | Resource health | `ResourceHealth.jsx` | Resources | yes | Code only |
| res-env | `/app/resources/environment` | Environment | `EnvironmentPage.jsx` | Resources | yes | Code only |
| res-cap | `/app/resources/capabilities` | Device capabilities | `DeviceCapabilities.jsx` | Resources | yes | Code only |
| alerts | `/app/alerts` | Active alerts | `AlertsEvents.jsx` | Alerts | yes | Code only |
| incidents | `/app/alerts/incidents` | Incidents | `AlertsEvents.jsx` | Alerts | yes | Code only |
| alert-detail | `/app/alerts/detail/:id` | Alert workspace | `AlertDetailPage.jsx` | Alerts | yes | Code only |
| incident-detail | `/app/alerts/incidents/:id` | Incident workspace | `IncidentDetailPage.jsx` | Alerts | yes | Code only |
| reports | `/app/reports` | Reports | `ReportsPage.jsx` | Record | yes | Code only |
| settings | `/app/settings` | Settings | `UserSettings.jsx` | Configure | yes | Code only |
| admin-int | `/app/admin/integrations` | Integrations | `AdministrationPage.jsx` | Admin | yes | Code only |
| admin-col | `/app/admin/collectors` | Collectors | `AdministrationPage.jsx` | Admin | yes | Code only |
| admin-rules | `/app/admin/rules` | Alert rules | `AdministrationPage.jsx` | Admin | yes | Code only |
| admin-users | `/app/admin/users` | Users & roles | `AdministrationPage.jsx` | Admin | yes | Code only |
| admin-logs | `/app/admin/logs` | Logs | `AdministrationPage.jsx` | Admin | yes | Code only |
| onboarding | `/app/onboarding` | Onboarding | `OnboardingFlow.jsx` | Configure | yes | Code only |
| login | `/login` (outside shell) | Login | `LoginPage.jsx` | Auth | no | Code only |

**Detail routes / modals (in-page, not separate URLs):** Resource health qubit modal (`InsightModal`), Alerts drawer (`DetailDrawer`), Job/Queue detail drawers, Topology node drawer, Platform pipeline drawer (component exists; removed from operator Platform health in recent partial fix — verify at runtime).

**Legacy redirects:** `/app/operations/*` → canonical paths (`isLegacyAppPath`).
