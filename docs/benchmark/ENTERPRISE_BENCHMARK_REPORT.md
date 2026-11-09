# Enterprise benchmark report — Q-TeleScope

**Date:** 2026-11-09  
**Audience:** Product + platform engineering  
**Index:** [INDEX.md](INDEX.md)

## Executive summary

Q-TeleScope already implements a **credible quantum operations console**: fleet inventory, live/historical telemetry, calibration/drift/topology, jobs/queues, alerts/incidents, reports/evidence, admin collectors, RBAC, and Playwright journey coverage. That matches **foundational** layers of Google/AWS/IBM monitoring products.

The gap versus mature platforms is less “missing charts” and more **missing interconnecting systems**: SLOs/error budgets, composite/correlated alerting, resource catalogue with ownership, unified log/trace exploration, pipeline observability, on-call/escalation, change management, synthetic probes, and policy-driven data quality at ingest.

**Strategic position:** Unified **control + observability plane** for quantum infrastructure (hardware, providers, calibration, workloads, facility, incidents, evidence) — not a CloudWatch clone.

## Repository baseline (verified)

| Area | Evidence |
| --- | --- |
| Protected UI routes | 28 — [../QA/SPRINT2_ROUTE_AUDIT.md](../QA/SPRINT2_ROUTE_AUDIT.md) |
| Page modules | `frontend/src/pages/*.jsx` (39 files; ~28 in-app routes) |
| API client surface | `frontend/src/services/api.js` (~100+ methods) |
| FastAPI domains | `backends`, `calibration`, `drift`, `queues`, `jobs`, `health`, `alerts`, `admin`, `reports`, `events` (SSE), `operations`, `topology`, `evidence`, `metrics`, `federated`, `anomalies`, `replay`, `auth`, `users`, … |
| Migrations | `alembic/versions/` (15 revisions incl. incidents, evidence, perf indexes) |
| Provenance | `app/core/provenance.py`, admin provenance API, `DataProvenanceBar` (UI partial) |
| Security (lab) | MFA Fernet, SMTP reset path, prod auth/RBAC defaults — [../QA/SPRINT3_SECURITY.md](../QA/SPRINT3_SECURITY.md) |
| E2E | 22+ pass serial — [../QA/E2E_TELESCOPE_EVIDENCE.md](../QA/E2E_TELESCOPE_EVIDENCE.md) |

## Ten benchmarking dimensions

### 1. Monitoring and observability

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Google | Metrics Explorer, dashboards, uptime | **PARTIAL** — trends, live telemetry, dashboard KPIs | Saved metric queries, compare windows, metric catalogue |
| AWS | Metric math, contributor insights | **PARTIAL** — derived health scores | Top-N qubit/gate/backend rankings API |
| Splunk | Baselines, anomalies | **PARTIAL** — `AnomalyMonitor`, drift | Explainable baselines + feedback |

### 2. Resource and fleet management

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| AWS | Resource groups | **PARTIAL** — inventory filters | Tagged backend groups, saved fleet views |
| Datadog | Service catalogue | **PARTIAL** — backend inventory only | Org → facility → backend hierarchy + owners |
| IBM | QPU inventory + lifecycle | **PARTIAL** — inventory + wizard | Processor revision timeline |

### 3. Telemetry pipelines and data architecture

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Splunk/OTel | Receiver → processor → exporter | **PARTIAL** — collectors + normalizers | Pipeline execution history, DLQ UX, quality report |
| OpenTelemetry | Traces | **UNIMPLEMENTED** | Instrument collection cycle spans |

### 4. Alerting, incidents, correlation

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| AWS | Composite alarms | **UNIMPLEMENTED** (boolean rules) | Provider+collection+staleness composite |
| Grafana | IRM, timelines | **PARTIAL** — incidents, assignment | Postmortems, escalation, comms log |

### 5. Automation and operational intelligence

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| AWS | Alarm actions | **PARTIAL** — acknowledgements | Runbook links, webhook actions |
| Azure | Change analysis | **UNIMPLEMENTED** | Change timeline before degradation |

### 6. Identity, security, governance

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Google/AWS | SSO, policy org | **PARTIAL** — LDAP bind, RBAC, MFA file store | OIDC, access review, policy inheritance |
| Datadog | Ownership on entities | **UNIMPLEMENTED** | Owner fields on backends/collectors |

### 7. Dashboards and UX

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Grafana | Variables, annotations | **PARTIAL** — dashboard layout localStorage | Chart event annotations (calibration, deploy) |
| Azure | Workbooks | **UNIMPLEMENTED** | Composable ops workbooks |

### 8. Reporting, analytics, evidence

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Custom | Evidence integrity | **PARTIAL** — snapshots, SHA in UI tests | Signed manifests, retention policies |
| IBM | Calibration packages | **PARTIAL** — reports export | Revision-diff exports |

### 9. Integrations and extensibility

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Mature APIs | Webhooks, API keys | **PARTIAL** — REST + OpenAPI | Developer centre, scoped credentials |
| Providers | Multi-vendor | **PARTIAL** — IBM/IonQ/Rigetti/on-prem slots | Circuit breaker per provider |

### 10. Enterprise deployment and reliability

| Benchmark | Pattern | Q-TeleScope | Borrow |
| --- | --- | --- | --- |
| Google SRE | SLOs / error budgets | **UNIMPLEMENTED** | Collector + API SLO definitions |
| AWS | Synthetic canaries | **PARTIAL** — Playwright lab only | Scheduled synthetic API/collector probes |
| Ops | Multi-facility | **PARTIAL** — environment page | Facility-scoped RBAC |

## Three strategic opportunities (from assessment)

1. **Quantum-specific observability** — IBM-depth calibration/gate/benchmark views across providers with honest provenance (stale ≠ 100% error).  
2. **Enterprise operations** — ownership, SLOs, correlation, escalation, catalogue (Datadog/Grafana patterns).  
3. **Evidence & reconstruction** — single timeline: backend → calibration revision → workload → telemetry → incident → signed export.

## Recommendation

Next engineering cycles should **wire existing pages** (investigation links, drawer → deep links, alert → logs/metrics windows) before adding greenfield modules. See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).
