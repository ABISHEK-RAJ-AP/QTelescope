# Q-TeleScope — Page Data Source Matrix

**Generated:** 2026-10-31  
**Source of truth:** `frontend/src/pages/*.jsx`, `frontend/src/services/api.js`, `app/api/*.py`  
**Legend — classification:** (1) Implemented verified (2) Not runtime-verified (3) Partial (4) Mock/seed/import (5) Stub (6) New required  
**Legend — storage:** `LIVE` provider path · `STORED` platform DB · `DERIVED` calculation · `ADVISORY` local rules · `SSE` stream · `IMPORT` facility file

| Page | Main data | API / source | Live or stored | Mock / stub risk | Required changes |
| ---- | --------- | ------------ | -------------- | ---------------- | ---------------- |
| Landing | Static copy | None | N/A | None | Optional copy only |
| Login | Auth, config | `POST /auth/login`, `GET /auth/config-status`, `GET /admin/deployment/profile` | STORED session | Captcha — verified in API (2) | Document captcha UX |
| Register | Auth | `POST /auth/register` | STORED | (2) | Same |
| Fleet Overview (Dashboard) | Fleet, alerts, jobs, queues, cal, coherence, platform, health vector, ops centre, timeline, failures, provenance | 14 calls in `DashboardHome.jsx` — see api.js | STORED + DERIVED | `enable_mock_data` via `getConfigStatus` / provenance (4) | Reduce calls; canonical alert KPIs; remove duplicate inventory table |
| Operator Console | Ops aggregate, alerts, timeline, federated | `GET /operations/centre`, `GET /alerts?status=ACTIVE`, `GET /operations/timeline`, `GET /federated/summary` | STORED | Centre includes `platform_data_mode` (4) | Single alert semantics; action queue layout |
| Platform Health | Platform checks | `GET /operations/platform-health` | STORED checks | (1) code path exists | Move nav group; link collectors |
| Backend Registry (Inventory) | Backends, queues | `GET /backends`, `GET /queues` | STORED registry | Backends may include mock catalog IDs (`MOCK_BACKEND_IDS` in backend) (4) | Freshness column; adapter status from verification API |
| Backend Workspace (Details) | Detail, status, qubits, cal, connectivity, jobs, queue, classical infra | `/backends/{id}/*`, `/jobs`, `/infra/classical/{id}` | STORED | Classical infra C-DAC only (3) | URL tabs; trim prose |
| Qubit Monitoring | Qubits, history | `GET /backends/{id}/qubits`, `GET /backends/{id}/qubits/{idx}/history` | STORED telemetry | Missing history = empty not failed qubit (1) | Merge into workspace; URL qubitId |
| Live Telemetry | SSE snapshots | `GET /events/stream` (EventSource), fields from `app/api/events.py` | SSE + STORED aggregates in payload | **Not vendor push** — platform refresh stream (1)(3) | Banner: refresh interval vs sample age; backend filter |
| Calibration Status | Per-backend cal | `GET /backends`, `GET /calibration/{id}` | STORED snapshots | Not all providers (5) | Fleet sort by freshness |
| Calibration Timeline | Timeline + events | `GET /calibration/{id}/timeline` | STORED | (1) | Split from status in nav |
| Drift Analysis | Drift series | `GET /drift`, `GET /drift/{id}`, qubit drift endpoints | DERIVED from STORED | Insufficient samples (3) | Explain baseline in UI |
| Historical Trends | Backend telemetry series | `GET /backends`, `GET /backends/{id}/telemetry` | STORED | Retention limits (3) | Show truncation/retention |
| Topology | Graph | `GET /backends/{id}/topology` | STORED/DERIVED | Empty edges (1) | A11y edge table |
| Compare Backends | Pairwise compare | `POST /health/compare`, `GET /backends` | DERIVED | Eligibility rules in API (1)(2) | Pre-check UI |
| Anomalies | EWMA summary | `GET /anomalies/summary` | DERIVED | Advisory (1) | Drill links |
| Telemetry Replay | Frames | `GET /replay/{id}/timeline` | STORED replay | **Not vendor rewind** (`temporal_replay.py`) (1) | Keep honest label |
| Metrics Coverage | Registry, capabilities, coverage | `GET /metrics/registry`, `/capabilities`, `/coverage` | STORED metadata | STUB providers in capabilities (5) | **One route** only |
| Jobs | Jobs, failures | `GET /jobs`, `GET /jobs/analytics/failures` | STORED | Status enum semantics (2) | Define denominators |
| Queues | Queues, analytics | `GET /queues`, `GET /queues/analytics/summary` | STORED | Wait time estimate fields (2) | Histogram if schema supports |
| Resource Health | Vector, modules, explain, quarantine | `GET /health/vector`, `/health/modules`, `/health/explain/{id}`, POST quarantine | DERIVED + ADVISORY | Quarantine = **local DB only** (1) | Reference fold; modality applicability |
| Environment | Facility JSON | `GET /environment`, ingest/import APIs | IMPORT | Live MQTT/cryo often STUB (5) | NOT_BUILT banner |
| Alerts | Alerts list | `GET /alerts` (optional filters) | STORED | Alerts page loads **all statuses** if no filter (3) | Canonical ACTIVE filter + reconcile sidebar |
| Incidents | Incidents | `GET /incidents`, workflow POSTs | STORED | Sync from alerts via ops centre (1) | Link alerts |
| Ops Timeline | Merged events | `GET /operations/timeline` | STORED | (1) | URL time + backend |
| Reports & Evidence | Exports, snapshots, ask | `/reports/export`, `/evidence/snapshots`, `/research/ask` | STORED | Ask = auxiliary narrative (3) | Manifest preview |
| Integrations (Admin slice) | Credentials, verification | `GET/POST /admin/credentials`, `GET /admin/adapters/verification` | STORED | `providers/truth.py` LIVE/STUB (1) | Split from monolith admin |
| Collectors (Admin slice) | Schedules, DLQ, collector health | `/admin/collection-schedules`, `/admin/collector-dlq`, `/admin/collector-health` | STORED | DLQ in admin load but **no dedicated UI** (3) | Collectors page |
| Alert Rules (Admin slice) | CRUD rules | `/admin/alert-rules` | STORED | (1) | Split page |
| Platform Settings (Admin slice) | Config, provenance, deployment | `/auth/config-status`, `/admin/provenance`, `/admin/deployment/profile` | STORED | Mock flag visible (4) | Split page |

### Global chrome

| Surface | API | Notes |
| ------- | --- | ----- |
| Sidebar alert badge | `GET /alerts?status=ACTIVE` poll 6s `App.jsx` | Count = **all ACTIVE**, not critical only |
| DataProvenanceBar | `GET /admin/provenance` | Does not show mock/simulated chip by design |
| Page refresh | Per-page `RefreshButton` | Title tooltip = last refresh local time |

### Alert count semantics (trust-critical)

| UI location | Metric shown | Source | Label |
| ----------- | ------------ | ------ | ----- |
| Dashboard exceptions | **Critical** count | `criticalAlerts.length` where `alerts` from `getAlerts('ACTIVE')` filtered `severity===CRITICAL` | `VERIFIED` `DashboardHome.jsx` |
| Dashboard alert list widget | Critical / Warning / Other | Same `alerts` array | `VERIFIED` |
| Operator Console strip | **Critical** (clickable) | Client filter on `getAlerts('ACTIVE')` | `VERIFIED` |
| Operator Console strip | **Active alerts (DB)** | `operations.active_alerts` **or** `alerts.length` fallback | `VERIFIED` `OperationsCentre.jsx` ~88 |
| Sidebar badge | **All ACTIVE** | `getAlerts('ACTIVE').length` | `VERIFIED` `App.jsx` |
| Ops centre API | `active_alerts` | DB count ACTIVE | `VERIFIED` `app/api/operations.py` ~42 |

**Diagnosis:** Not necessarily “87 vs 0” from code — **critical vs total active** and **Alerts page default** (`getAlerts()` without status = up to 100 all statuses) can look contradictory. **P0:** one glossary + consistent filters.
