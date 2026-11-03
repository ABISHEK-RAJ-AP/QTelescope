# Q-TeleScope — Page and Feature Matrix

**Re-verified:** 2026-10-31 (post IMP-P0–P6) | **Evidence:** SRC + RUN (**84 pytest**, OpenAPI ~53+ paths)

Legend: **L** live/DB-backed | **M** mock/simulated path | **P** partial | **S** stub/static | **NV** not runtime-verified UI

| Page | File | Nav / URL | Primary APIs | Data class | Status (IMP) |
|------|------|-----------|--------------|------------|--------------|
| Landing | `LandingPage.jsx` | `/` | none | S | Preserve |
| Login | `LoginPage.jsx` | `/login` | `/auth/*`, captcha | L | Session + Operator → `/app/operations` |
| Register | `RegisterPage.jsx` | `/register` | `/auth/register` | L | Admin blocked (API+UI) |
| Dashboard | `DashboardHome.jsx` | `/app` | summary, coherence, … | L/M | Modality KPI strip (P2) |
| Operations Centre | `OperationsCentre.jsx` | `/app/operations` | centre, federated, identity | L/P | Tabs: centre / health / timeline (P3) |
| Backend Inventory | `BackendInventory.jsx` | `/app/backends/inventory` | `/backends` | L/M | Sort + page (P2) |
| Qubit Monitoring | `QubitMonitoring.jsx` | `/app/backends/qubits` | qubits API | L/M | Preserve |
| Backend Details | `BackendDetails.jsx` | `/app/backends/details/:id` | backend bundle | L/M/P | Deep link (P1) |
| Live Telemetry | `LiveTelemetry.jsx` | `/app/telemetry/live` | SSE `/events/stream` | P | Per-modality T1; honest refresh copy (P0/P2) |
| Calibration Status | `CalibrationStatus.jsx` | `/app/telemetry/calibration` | `/calibration` | L | Preserve |
| Drift Analysis | `DriftAnalysis.jsx` | `/app/telemetry/drift` | `/drift/*` | L | Shared lookback window (P2) |
| Historical Trends | `HistoricalTrends.jsx` | `/app/telemetry/trends` | qubit history | L | Preserve |
| Topology Explorer | `TopologyExplorer.jsx` | `/app/telemetry/topology` | topology | L | Preserve |
| Calibration Timeline | `CalibrationTimeline.jsx` | `/app/telemetry/cal-timeline` | timeline | L | Shared lookback (P2) |
| Backend Comparison | `BackendComparison.jsx` | `/app/telemetry/compare` | `/health/compare` | L | Modality-safe (P2) |
| Anomaly Monitor | `AnomalyMonitor.jsx` | `/app/telemetry/anomalies` | `/anomalies/*` | L | Preserve |
| Temporal Replay | `TemporalReplay.jsx` | `/app/telemetry/replay` | `/replay/*` | L | Preserve |
| Metrics explorer | `MetricsCoverage.jsx` | `/app/telemetry/metrics` | `/metrics/*` | L | Added P2 (also Resources) |
| Job Monitoring | `JobMonitoring.jsx` | `/app/execution/jobs` | `/jobs` | L/M | Filter + pagination |
| Queue Monitoring | `QueueMonitoring.jsx` | `/app/execution/queues` | `/queues` | L/M | Preserve |
| Resource Health | `ResourceHealth.jsx` | `/app/resources/health` | `/health/*` | L advisory | Quarantine copy (P0) |
| Environment | `EnvironmentPage.jsx` | `/app/resources/environment` | `/environment/*` | L import | MQTT NOT_BUILT (P5) |
| Metrics Coverage | `MetricsCoverage.jsx` | `/app/resources/metrics` | `/metrics/*` | L | Same as telemetry metrics tab |
| Alerts + Incidents | `AlertsEvents.jsx` | `/app/alerts`, `/incidents` | alerts, incidents | L | Single nav; incident workflow (P3) |
| Reports / Evidence | `ReportsPage.jsx` | `/app/reports` | evidence, research | L/P | Bearer ZIP download (P3) |
| Administration | `AdministrationPage.jsx` | `/app/admin` | `/admin/*` | L/S mix | Truth labels, DLQ, live verify (P5) |

Shell: `DataProvenanceBar`, skip-link, `/app/*` routing (`appNav.js`).

### Feature × layer matrix (post-IMP)

| Feature | FE | API | Storage | Truth / notes |
|---------|----|-----|---------|----------------|
| Auth session | Bearer + localStorage | `REQUIRE_API_AUTH`, `/auth/me` | sessions + optional `user_accounts` | IMP-P0 |
| RBAC | `X-User-Role` + Bearer role | `ENFORCE_RBAC` on mutators | — | IMP-P0/P3 |
| SSE stream | LiveTelemetry | `t1_by_modality`, refresh metadata | DB aggregates | Not vendor live (P0/P2) |
| Provider catalog | Admin truth badges | `/admin/credentials` | JSON + env | STUB vs MOCK_ONLY vs LIVE_* (P5) |
| Health quarantine | ResourceHealth | POST quarantine + audit | qubit status | Advisory (P0) |
| Federated national | Operations table | import + HMAC optional | `federation_snapshots/` | Not live mesh (P6) |
| Evidence ZIP | Reports | RBAC download | files + DB | IMP-P3 |
| Deep links | App shell | — | — | IMP-P1 |
| Retention | Admin job | `/admin/retention/*` | telemetry tables | IMP-P4 |
| Collector DLQ | Admin + platform health | discovery + jsonl | `collector_dlq.jsonl` | IMP-P5 |

See `QTelescope_Enterprise_Product_Evolution_Blueprint.md`, `.planning/qtelescope-national/NATIONAL_CHECKLIST_PHASE_MAP.md`.
