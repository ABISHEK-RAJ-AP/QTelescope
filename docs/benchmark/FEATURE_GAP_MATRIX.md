# Feature gap matrix

**Date:** 2026-11-09 · [INDEX.md](INDEX.md)

Priority: **P0** foundation · **P1** enterprise ops · **P2** quantum depth · **P3** research/advanced

| Feature | Benchmark | Status | Repo evidence | Gap / next step | Pri |
| --- | --- | --- | --- | --- | --- |
| Fleet inventory | Google/AWS | **COMPLETE** | `BackendInventory.jsx`, `GET /backends` | Lifecycle states, groups | P1 |
| Live telemetry SSE | Splunk | **PARTIAL** | `LiveTelemetry.jsx`, `events.py` | Last-Event-ID replay | P1 |
| Historical metrics | Google | **PARTIAL** | `MetricsExplorer.jsx` saved queries + compare; `HistoricalTrends.jsx` | Server-backed saved queries, modality registry | P1 |
| Custom dashboards | Grafana | **PARTIAL** | `DashboardHome.jsx` layout save | Widget library, share | P1 |
| SLO / error budget | Google SRE | **UNIMPLEMENTED** | — | `slo_*` schema + UI | P1 |
| Composite alerts | AWS | **UNIMPLEMENTED** | `alert_engine.py` single-type rules | Boolean rule DSL | P1 |
| Anomaly detection | AWS/Splunk | **PARTIAL** | `AnomalyMonitor.jsx`, anomaly APIs | Baselines + explain | P2 |
| Synthetic monitoring | AWS | **PARTIAL** | Playwright `tests/e2e/` | Scheduled probes + admin UI | P2 |
| Resource catalogue | Datadog | **PARTIAL** | Inventory only | `resource_registry` model | P1 |
| Ownership / escalation | Datadog/Grafana | **UNIMPLEMENTED** | — | Owner on backend/collector | P1 |
| On-call rotation | Grafana IRM | **UNIMPLEMENTED** | — | Schedules + notify routes | P2 |
| Logs explorer | Splunk | **PARTIAL** | Admin audit search on `audit_events.jsonl`; no app log index | Unified log index + UI | P1 |
| Distributed tracing | OTel | **UNIMPLEMENTED** | `X-Request-Id` only | OTel SDK + Trace Explorer | P1 |
| Notification routing | Grafana | **PARTIAL** | SMTP reset; no alert routing | Templates, Teams/Slack | P1 |
| Change management | Azure | **UNIMPLEMENTED** | Audit partial | Change requests + windows | P2 |
| Config drift | Azure | **UNIMPLEMENTED** | — | Diff admin config vs policy | P2 |
| Data quality engine | Splunk | **PARTIAL** | Provenance, health engine | Per-ingest quality report | P1 |
| Telemetry pipeline mgmt | OTel | **PARTIAL** | `collectors/`, scheduler | Pipeline run history UI | P1 |
| Event store / outbox | Event-driven | **PARTIAL** | SSE, `audit_events` | Durable outbox + replay | P2 |
| Circuit breaker (providers) | AWS | **UNIMPLEMENTED** | — | Per-adapter breaker + stale UX | P1 |
| Multi-facility tenancy | AWS org | **PARTIAL** | `EnvironmentPage.jsx` | Facility-scoped queries | P2 |
| Hardware capability registry | IBM | **PARTIAL** | `DeviceCapabilities.jsx`, capabilities API | Versioned JSON profile | P2 |
| Instruction-level metrics | IBM | **PARTIAL** | Topology, calibration tabs | Gate/edge error history | P2 |
| Calibration intelligence | IBM | **PARTIAL** | `CalibrationStatus`, snapshots migration | measured vs cal update times | P2 |
| Benchmarking centre | IBM | **UNIMPLEMENTED** | — | `benchmark_runs` + UI | P2 |
| Workload reconstruction | Custom | **PARTIAL** | `TemporalReplay.jsx`, jobs | Calibration-aware epoch | P2 |
| Evidence signing | Custom | **PARTIAL** | `ReportsPage`, evidence zip | Verify + policy retention | P1 |
| Command palette | Google-ish | **PARTIAL** | `CommandPalette.jsx` nav only | Entity search | P1 |
| Detail drawer pattern | Enterprise UX | **PARTIAL** | `DetailDrawer.jsx` (modal) | Quick-view on tables | P1 |
| Enterprise data grid | — | **PARTIAL** | `EnterpriseDataTable` on few routes | Rollout per route audit | P0 |
| Unified status dictionary | — | **PARTIAL** | `backendUtils.js` states | Cross-entity status doc | P1 |
| Chart annotations | Grafana | **UNIMPLEMENTED** | ECharts pages | Overlay calibration/incidents | P2 |
| API developer centre | — | **UNIMPLEMENTED** | OpenAPI `/docs` | Keys, webhooks UI | P2 |
| SSO OIDC/SAML | Cloud IdP | **PARTIAL** | LDAP in auth | OIDC middleware | P2 |
| Readiness scorecards | Datadog | **UNIMPLEMENTED** | — | Backend readiness checklist | P2 |
| Facility ops centre | Custom | **PARTIAL** | `EnvironmentPage.jsx` | Cryo/sensor correlation | P3 |
| Predictive analytics | — | **UNIMPLEMENTED** | — | After data maturity | P3 |

**Counts (matrix rows above):** COMPLETE 1 · PARTIAL 28 · UNIMPLEMENTED 17 (indicative sample of 46 rows; full programme uses same taxonomy for new rows).
