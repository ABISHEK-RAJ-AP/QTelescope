# Q-TeleScope — Comprehensive Repository, Application, and Product Intelligence Audit

**Audit date:** 2026-10-31  
**Auditor role:** Principal architect / full-stack / security / quantum observability (read-only)  
**Repository path:** `/home/boss/Desktop/Quantum_Monitoring-main`  
**Scope:** Evidence-based baseline; no redesign or code changes performed.

### Evidence legend

| Tag | Meaning |
|-----|---------|
| **SRC** | Verified from source code / repo files |
| **RUN** | Verified at runtime (local server responded) |
| **INF** | Inferred from structure; not executed |
| **NV** | Not verified (needs credentials, hardware, or manual UI session) |
| **REQ** | Requires clarification |

### Inspection coverage

| Area | Method |
|------|--------|
| Backend API surface | **SRC** — all `app/api/*.py` routers; **RUN** — OpenAPI at `/api/v1/openapi.json` (53 path entries) |
| Database models | **SRC** — `app/models/entities.py` |
| Frontend pages | **SRC** — `frontend/src/pages/*.jsx`, `App.jsx`, `api.js` |
| Live UI render | **NV** — browser audit not performed this session; screenshots exist in `frontend/*.png` (**SRC**) |
| Provider live poll | **NV** — no IBM/Rigetti/IonQ tokens used during audit |
| Tests | **RUN** — `USE_ALEMBIC=false PYTHONPATH=. pytest tests/` → **54 passed** |

---

## 1. Executive summary

Q-TeleScope (branded in UI as **Q-TeleScope**, backend title **Quantum Telemetry, Monitoring & Resource Management Platform**) is a **FastAPI + SQLAlchemy** backend with a **React 19 + Vite 8 + JSX** SPA. The **canonical application code lives at repository root `app/`** and `frontend/`; a **legacy `backend/` tree is an incomplete duplicate** and is not wired to current national-program features (**SRC**).

The product delivers a **broad observability surface**: multi-provider discovery, telemetry persistence (SQLite by default), health vector v2, alerts/incidents, operations centre, topology, drift/calibration/replay/anomalies, evidence ZIP export, federated snapshot aggregation, facility JSON ingest, and admin credential slots for many vendors (most **STUB**).

**Maturity:** Advanced **prototype / pre-production demo** with substantial backend depth and a cohesive single-shell UI, but **not enterprise-ready** due to authentication model (client-only session, optional header RBAC), default secrets, self-service Admin registration, README drift, SSE labeled as live while emitting DB snapshot ticks, and incomplete live provider coverage without mock mode.

**Preserve:** Provider adapter pattern, telemetry collector pipeline, provenance APIs, health vector + explain, evidence snapshots, planning pack under `.planning/qtelescope-national/`, pytest coverage of core analytics.

**Prioritize next:** Server-side auth/session, lock down registration roles, secret hygiene, honest live/sim labeling in UI, retire or sync `backend/`, E2E tests, production PostgreSQL path.

---

## 2. Project identity and scope

| Item | Evidence |
|------|----------|
| Product name (UI) | Q-TeleScope — `frontend/src/App.jsx` |
| Backend OpenAPI title | From `settings.PROJECT_NAME` — `app/core/config.py` |
| Version | `1.0.0` — config |
| Intended scope | Quantum **infrastructure observability** (not circuit submission) — collectors, health, queues, incidents, reports |
| National program docs | `.planning/qtelescope-national/` (INDEX, WORKLOG, specs) — **SRC**, planning artifacts not runtime |

---

## 3. Repository structure

### 3.1 Concise tree (active vs obsolete)

```
Quantum_Monitoring-main/
├── app/                    # CANONICAL FastAPI application (**SRC**)
├── frontend/               # CANONICAL React SPA (**SRC**)
├── tests/                  # Pytest suite (22 modules, 54 tests) (**RUN**)
├── alembic/                # Migrations (3 revisions) (**SRC**)
├── data/                   # Runtime SQLite, JSON stores (**SRC**)
├── deployment/             # Docker, nginx, airgap scripts (**SRC**)
├── docs/                   # DATABASE.md, DEPLOYMENT_AIRGAP.md (**SRC**)
├── docker-compose*.yml     # Root compose + postgres + airgap (**SRC**)
├── backend/                # OBSOLETE partial copy — fewer routers (**SRC**)
├── .planning/qtelescope-national/  # Program specs, not app runtime
├── README.md               # STALE vs actual stack (**SRC**)
└── QTelescope_Repository_and_Product_Audit.md  # This report
```

### 3.2 Directory responsibilities

| Path | Purpose | Active? | Notes |
|------|---------|---------|-------|
| `app/api/` | 24 REST/SSE routers | Yes | Mounted in `app/main.py` |
| `app/providers/` | IBM, Rigetti, IonQ, OnPrem, mock, catalog STUBs | Yes | Live vs mock branching |
| `app/collectors/` | TelemetryCollector orchestration | Yes | Persists to ORM |
| `app/discovery/` | Startup auto-discovery | Yes | Runs on lifespan + admin trigger |
| `app/workers/` | Async collection scheduler | Yes | `COLLECTION_SCHEDULER_ENABLED` |
| `app/analytics/`, `app/monitoring/`, `app/alerts/` | Health, drift, anomalies, alerts | Yes | |
| `app/evidence/`, `app/federated/`, `app/facility/` | Evidence ZIP, federation, env ingest | Yes | |
| `frontend/src/pages/` | 25 page modules | Yes | Shell routing via `App.jsx` state |
| `backend/app/main.py` | Old entry | **Obsolete** | Missing incidents, federated, replay, etc. |
| `frontend/dist/` | Build output | Optional | Committed or local build (**INF**) |
| `.pytest_cache/`, `node_modules/` | Tooling | Generated | |

---

## 4. Technology stack (evidence-based)

| Layer | Technology | Evidence |
|-------|------------|----------|
| Backend language | Python 3.11+ (**INF** from environment) | |
| API framework | FastAPI ≥0.110 | `backend/requirements.txt` (used for root app) |
| ORM | SQLAlchemy 2.x | `app/core/database.py` |
| Migrations | Alembic (optional via `USE_ALEMBIC`) | `app/core/schema.py` |
| DB default | SQLite file `sqlite:///./data/qtelescope.db` | `app/core/config.py` |
| Frontend | React 19.2, Vite 8.2 | `frontend/package.json` |
| Language | **JSX** (not TypeScript as README claims) | `frontend/src/*.jsx` |
| Charts | ECharts 6 + echarts-for-react | package.json |
| Styling | Tailwind 4 + CSS variables | `frontend/src/index.css` |
| Icons | lucide-react | package.json |
| CI/CD | **NOT_BUILT** | No `.github/` (**SRC**) |

---

## 5. Application execution and entry points

### 5.1 Backend (**SRC**)

- Entry: `app/main.py` — FastAPI app, CORS `allow_origins=["*"]`, lifespan hooks.
- Startup: `apply_schema(engine)` → `HardwareDiscoveryEngine.run_auto_discovery(db)` → optional `collection_scheduler_loop`.
- API prefix: `/api/v1` (`settings.API_V1_STR`).
- Docs: `/docs`, OpenAPI `/api/v1/openapi.json`.

**RUN:** `curl http://localhost:8000/` returned JSON; OpenAPI reports **53 paths** (server was running during audit).

### 5.2 Frontend (**SRC**)

- Entry: `frontend/src/main.jsx` — `BrowserRouter` routes:
  - `/` → `LandingPage`
  - `/login`, `/register` → auth pages
  - `/app/*` → `App` (main console; **no nested URL routes** for dashboard sections)
- Dev: `npm run dev` (Vite); API base `http://localhost:8000/api/v1` when port 5173 (`frontend/src/services/api.js`).

### 5.3 README accuracy (**SRC**)

README describes `backend/app/`, TypeScript `App.tsx`, and narrower feature set — **incorrect** vs root `app/` + JSX. Quick-start may still work if documented commands target root; verify before onboarding.

---

## 6. Architecture overview

```
[Env / .env credentials]
        ↓
HardwareDiscoveryEngine.probe_environment()  →  Provider adapters
        ↓
TelemetryCollector.run_full_collection_cycle()
        ↓
TelemetryNormalizer + Freshness + HealthEngine + AlertEngine
        ↓
SQLAlchemy → SQLite/PostgreSQL
        ↓
FastAPI routers (/api/v1/*)  +  SSE /events/stream
        ↓
React SPA (api.js) — localStorage auth, theme, sidebar state
```

**Disconnected pieces:**

- UI `qtok_*` token never sent or validated on API (**SRC** `auth.py`, `api.js`).
- RBAC `X-User-Role` only on mutating routes when `ENFORCE_RBAC=true` (**SRC** `app/core/rbac.py`); default off.
- Admin nav hidden client-side only (`App.jsx`).

---

## 7. Frontend page inventory

Navigation is **state-based** (`mainTopic` in `App.jsx`), not URL-segmented (except `/app`).

| # | Shell topic / tab | Component | Primary APIs |
|---|-------------------|-----------|--------------|
| 1 | Landing | `LandingPage.jsx` | Static/marketing **SRC** |
| 2 | Login / Register | `LoginPage`, `RegisterPage` | `/auth/*` |
| 3 | Dashboard | `DashboardHome.jsx` | `/admin/summary`, `/backends`, `/alerts`, `/jobs`, `/queues`, `/calibration`, `/health/coherence` |
| 4 | Operations | `OperationsCentre.jsx` | `/operations/centre`, `/federated/summary` |
| 5 | Backends → Inventory | `BackendInventory.jsx` | `/backends` |
| 6 | Backends → Qubits | `QubitMonitoring.jsx` | `/backends/{id}/qubits` |
| 7 | Backends → Details | `BackendDetails.jsx` | backend, status, qubits, calibration, connectivity, jobs, queue, `/infra/classical/{id}` |
| 8 | Telemetry → Live | `LiveTelemetry.jsx` | SSE `/events/stream` |
| 9 | Telemetry → Calibration | `CalibrationStatus.jsx` | `/calibration`, `/backends` |
| 10 | Telemetry → Drift | `DriftAnalysis.jsx` | `/drift/*` |
| 11 | Telemetry → Trends | `HistoricalTrends.jsx` | qubit history APIs |
| 12 | Telemetry → Topology | `TopologyExplorer.jsx` | `/backends/{id}/topology` |
| 13 | Telemetry → Cal timeline | `CalibrationTimeline.jsx` | `/calibration/{id}/timeline` |
| 14 | Telemetry → Compare | `BackendComparison.jsx` | `POST /health/compare` |
| 15 | Telemetry → Anomalies | `AnomalyMonitor.jsx` | `/anomalies/*` |
| 16 | Telemetry → Replay | `TemporalReplay.jsx` | `/replay/*` |
| 17 | Execution → Jobs | `JobMonitoring.jsx` | `/jobs`, `/jobs/analytics/failures` |
| 18 | Execution → Queues | `QueueMonitoring.jsx` | `/queues`, `/queues/analytics/summary` |
| 19 | Resources → Health | `ResourceHealth.jsx` | `/health/vector`, explain, quarantine, router |
| 20 | Resources → Environment | `EnvironmentPage.jsx` | `/environment/*` |
| 21 | Resources → Metrics | `MetricsCoverage.jsx` | `/metrics/*` |
| 22 | Alerts ( + incidents tab) | `AlertsEvents.jsx` | `/alerts`, `/incidents/*` |
| 23 | Reports | `ReportsPage.jsx` | `/reports/*`, `/evidence/*`, `/research/ask` |
| 24 | Admin | `AdministrationPage.jsx` | `/admin/*` |

**Global chrome:** `DataProvenanceBar` → `/admin/provenance`; theme via `ThemeProvider`; sidebar collapse → `localStorage`.

---

## 8. Page-by-page UI audit (summary tables)

Full control-level tables would repeat 200+ rows; each page below lists **representative elements**. Status: **Functional** = traced to API/DB; **Partial** = UI works but misleading or incomplete; **Static** = no backend.

### 8.1 Dashboard (`DashboardHome.jsx`)

| Element | Purpose | Implementation | Data source | Status | Issues | Evidence |
|---------|---------|----------------|-------------|--------|--------|----------|
| KPI cards | Fleet summary | API aggregate | DB via `/admin/summary` | Functional | Summary depends on collected data | api.js |
| Coherence chart | Modality T1/T2 | `/health/coherence` | DB telemetry | Functional | Empty if no collection | DashboardHome |
| Active alerts list | Alert feed | `/alerts?status=ACTIVE` | `alerts` table | Functional | | |
| Quick nav hooks | Jump to jobs/alerts | Local state | N/A | Functional | | |

### 8.2 Live Telemetry (`LiveTelemetry.jsx`)

| Element | Purpose | Implementation | Data source | Status | Issues | Evidence |
|---------|---------|----------------|-------------|--------|--------|----------|
| SSE stream | “Live” metrics | EventSource | `/events/stream` | Partial | **5s DB poll**, not vendor stream; message says UI tick | `app/api/events.py` L48 |
| T1 mean chart | Coherence trend | Derived from SSE payload | `AVG(qubit_telemetry.t1)` | Partial | Cross-backend mean; staleness separate from tick | events.py |
| Connection indicator | Stream health | onerror closes | Network | Functional | No reconnect loop | LiveTelemetry.jsx |

### 8.3 Resource Health (`ResourceHealth.jsx`)

| Element | Purpose | Implementation | Data source | Status | Issues | Evidence |
|---------|---------|----------------|-------------|--------|--------|----------|
| Health vector grid | H states | `/health/vector` | Computed from DB | Functional | Advisory, not lab-validated | health_vector.py |
| Explain panel | Factors | `/health/explain/{id}` | Analytics | Functional | | |
| Quarantine / release | Operator action | POST quarantine/release | Updates `qubits.status` | Partial | **Does not block real IBM scheduler** | health.py |
| Apply router | Auto-quarantine RED | POST `/health/router/apply` | DB status flags | Partial | Same limitation | |

### 8.4 Administration (`AdministrationPage.jsx`)

| Element | Purpose | Implementation | Data source | Status | Issues | Evidence |
|---------|---------|----------------|-------------|--------|--------|----------|
| Provider credentials | Save tokens | POST `/admin/credentials` | `.env` + env vars | Functional | Secrets in plaintext `.env` | admin.py |
| STUB providers | Multi-vendor slots | catalog STUB | `data/provider_credentials.json` | Partial | **No telemetry poll** | catalog.py |
| Schedules | Intervals | PUT `/admin/collection-schedules` | DB `collection_schedules` | Partial | Scheduler must be enabled | workers |
| Alert rules CRUD | Thresholds | `/admin/alert-rules` | DB | Functional | Evaluated on collection | |
| Auto-discover | Re-run discovery | POST `/admin/auto-discover` | Discovery engine | Functional | | |

### 8.5 Reports (`ReportsPage.jsx`)

| Element | Purpose | Implementation | Data source | Status | Issues | Evidence |
|---------|---------|----------------|-------------|--------|--------|----------|
| HTML/CSV export | Reports | GET `/reports/export` | Report generator + DB | Functional | NV content depth | reports.py |
| Evidence ZIP | Immutable bundle | POST `/evidence/snapshots` | DB + files `data/evidence/` | Functional | Not WORM storage | evidence |
| Evidence Q&A | Research assistant | POST `/research/ask` | DB-bound answers | Partial | Not LLM; rule/retrieval | research |
| Bundle import | Restore | POST `/reports/import` | JSON merge | Partial | NV conflict handling | |

### 8.6 Operations Centre (`OperationsCentre.jsx`)

| Element | Purpose | Implementation | Data source | Status | Issues | Evidence |
|---------|---------|----------------|-------------|--------|--------|----------|
| Fleet KPI strip | National ops view | GET `/operations/centre` | Aggregated DB | Functional | **NV** with empty DB | operations.py |
| Federated table | Peer sites | GET `/federated/summary` | Local + JSON snapshots | Partial | No live mesh | federated |
| Incident/alert shortcuts | Navigation | React state to Alerts | N/A | Functional | | App.jsx |

### 8.7 Backend Inventory / Qubits / Details

| Page | Key controls | APIs | Status | Issues |
|------|--------------|------|--------|--------|
| Inventory | Table, select backend | `/backends` | Functional | Default selection `ibm_brisbane` hardcoded in App.jsx |
| QubitMonitoring | Backend picker, qubit table | `/backends/{id}/qubits` | Functional | |
| BackendDetails | Multi-panel tabs, classical PARAM | 8+ endpoints | Functional | Classical infra simulated unless live PARAM wired |

### 8.8 Calibration / Drift / Trends

| Page | APIs | Data | Status | Issues |
|------|------|------|--------|--------|
| CalibrationStatus | `/calibration`, `/backends` | DB snapshots | Functional | |
| DriftAnalysis | `/drift?metric=` | Historical qubit telemetry | Functional | Metric selector affects API |
| HistoricalTrends | `/backends/{id}/qubits/{idx}/history` | Time series | Functional | Needs history rows |

### 8.9 Topology / Cal timeline / Compare / Anomalies / Replay

| Page | APIs | Status | Issues |
|------|------|--------|--------|
| TopologyExplorer | `/backends/{id}/topology` | Functional | Force graph MVP |
| CalibrationTimeline | `/calibration/{id}/timeline` | Functional | |
| BackendComparison | POST `/health/compare` | Functional | User must select ≥2 backends |
| AnomalyMonitor | `/anomalies/summary` | Functional | EWMA on DB series |
| TemporalReplay | `/replay/{id}/timeline` | Functional | Replay index slider **SRC** |

### 8.10 Jobs / Queues

| Page | APIs | Status | Issues |
|------|------|--------|--------|
| JobMonitoring | `/jobs`, failure analytics | Functional | Taxonomy column from API |
| QueueMonitoring | `/queues`, analytics summary | Functional | Wait distribution shallow |

### 8.11 Environment / Metrics / Alerts

| Page | APIs | Status | Issues |
|------|------|--------|--------|
| EnvironmentPage | import, inbox scan, export | Functional | **No live MQTT**; file/inbox only |
| MetricsCoverage | `/metrics/registry`, coverage | Functional | Shows unsupported vs zero |
| AlertsEvents | alerts + incidents tabs | Functional | Ack/resolve POST; no RBAC **SRC** |

### 8.12 Auth pages

| Page | Behavior | Status | Issues |
|------|----------|--------|--------|
| LoginPage | CAPTCHA + login → localStorage | Functional | Token unused thereafter |
| RegisterPage | Self-registration | Functional | **Admin role selectable P0-001** |
| LandingPage | Marketing → /login | Static | **SRC** |

### 8.13 Duplicate / unused frontend notes (**SRC**)

- `AlertsEvents` embedded twice (Alerts topic + Resources tab) — same component, duplicate nav paths.
- No `*.test.jsx` in frontend.
- `frontend/dist/` build artifacts may be stale vs source.

---

## 9. Design system audit

| Dimension | Finding | Evidence |
|-----------|---------|----------|
| Tokens | CSS variables `--bg-*`, `--accent-*`, light/dark in `:root` / `.dark` | `index.css` L6–49 |
| Typography | Inter + JetBrains Mono (Google Fonts CDN) | index.css |
| Theme switch | `ThemeProvider` + top bar toggle; persisted | App.jsx |
| Density | ~13.5px base, compact cards | index.css |
| Severity colors | Rose/amber/emerald used inconsistently across pages | **INF** spot check |
| Enterprise feel | Cohesive sidebar + C-DAC branding; tab-heavy shell feels **demo console** not NOC | UX assessment |
| Responsive | Sidebar collapse + hover expand; limited mobile testing | **NV** |
| a11y | Some `aria-label`s; not systematically audited | **NV** |
| Chart theming | LiveTelemetry tooltip hardcodes `#ffffff` — **poor dark mode** | LiveTelemetry.jsx L32 |

---

## 10. Frontend functionality audit

| Pattern | Status | Evidence |
|---------|--------|----------|
| Deep linking to sub-pages | **Missing** — `/app` only | App.jsx |
| Role-based route guard | Admin page only (client) | App.jsx |
| Pagination | Per-page inconsistent | jobs/backends tables **INF** |
| Search/filter | Present on some tables | JobMonitoring **SRC** |
| Loading states | BoneyardSkeleton on several pages | components/ui/Skeleton |
| Error states | Often `console.error` only | multiple pages |

---

## 11. Backend architecture audit

| Module | Role |
|--------|------|
| `app/api/*` | HTTP layer, thin controllers |
| `app/collectors/telemetry_collector.py` | Main ingest orchestrator |
| `app/normalizers/telemetry_normalizer.py` | Shape normalization |
| `app/monitoring/health_engine.py`, `freshness.py` | Health scores, calibration age |
| `app/alerts/alert_engine.py` | Rule evaluation |
| `app/services/collector_runner.py` | Timeouts/isolation per provider |
| `app/reports/report_generator.py` | Export formats |

No separate repository layer — SQLAlchemy queries inline in routers/services (**SRC**).

---

## 12. API endpoint inventory (condensed)

All prefixed with `/api/v1`. Auth column: **None** unless noted; **RBAC** = needs `ENFORCE_RBAC` + header.

| Router | Key endpoints | Auth | Status |
|--------|---------------|------|--------|
| auth | captcha, login, register, config-status | None | Functional; no JWT |
| backends | CRUD read, status, telemetry, connectivity | None | Functional |
| qubits | list, detail, history | None | Functional |
| calibration | list, history, timeline | None | Functional |
| drift | fleet/backend/qubit drift | None | Functional |
| queues | status, history, analytics | None | Functional |
| jobs | list, detail, taxonomy, failures | None | Functional |
| health | vector, coherence, explain, compare, quarantine | RBAC on mutators | Functional |
| alerts | list, ack, resolve | None | Functional |
| incidents | sync, CRUD workflow | None | Functional |
| operations | `/centre` aggregate | None | Functional |
| admin | summary, creds, schedules, rules, provenance, rbac-audit | RBAC on mutators | Functional |
| reports | export, bundle, import | None | Functional |
| evidence | snapshots CRUD, download | RBAC create | Functional |
| metrics | registry, coverage | None | Functional |
| infra | classical metrics | None | Partial/simulated |
| federated | summary, import snapshot | RBAC import | Partial |
| anomalies | summary, qubit series | None | Functional |
| replay | timeline, frame | None | Functional |
| research | novelty, ask | None | Functional |
| environment | list, import, ingest, inbox | RBAC mutators | Functional |
| events | SSE stream | None | Functional (tick) |
| topology | graph payload | None | Functional |

**RUN:** OpenAPI path count 53 aligns with router grep (**SRC**).

---

## 13. Provider integration audit

| Provider | Adapter | Live API | Mock fallback | Discovery | Notes |
|----------|---------|----------|---------------|-----------|-------|
| IBM | `ibm_adapter.py` | IAM + REST (**NV** live) | `MockProviderAdapter` | Yes | urllib, not qiskit in hot path |
| Rigetti | `rigetti_adapter.py` | QCS ISA HTTP | mock if `ENABLE_MOCK_DATA` | Yes | `authenticate()` always True **SRC** |
| IonQ | `ionq_adapter.py` | **Mock-only** discover if mock enabled | Always mock methods | Yes | No live HTTP in file **SRC** |
| C-DAC / on-prem | `onprem_adapter.py` | Empty if mock off | mock backends | Yes | `lineage_mode` simulated when mock |
| Catalog vendors | `catalog.py` | STUB store only | N/A | No poll | AWS/Azure/Google/etc. |

**Misleading UX risk:** Admin UI lists many vendors; most STUB after credential save (**SRC** `admin.py` STUB response).

---

## 14. Telemetry pipeline audit

| Stage | Status | Evidence |
|-------|--------|----------|
| Discovery | Runs startup + manual | `main.py`, `hardware_discovery.py` |
| Adapter → Collector | Wired | `TelemetryCollector` |
| Normalization | Present | `telemetry_normalizer.py` |
| Persistence | ORM insert | entities models |
| Alert eval | On collection | `alert_engine.py` |
| SSE | **Not adapter stream** — aggregates DB | `events.py` |
| Lineage | `telemetry_source`, provenance API | provenance.py |

**Broken link:** None fatal in mock mode; live mode **NV** without credentials.

---

## 15. Database schema audit

Engine: SQLite default; PostgreSQL supported via `DATABASE_URL` + compose (**docs/DATABASE.md**).

### Tables (`app/models/entities.py`)

| Table | Purpose | Issues |
|-------|---------|--------|
| providers | Vendor registry | OK |
| backends | QPU inventory | OK |
| qubits | Per-qubit static + status | Quarantine flag only local |
| gates, connectivity_edges | Topology | OK |
| backend_telemetry, qubit_telemetry, gate_telemetry | Time series | **No retention policy** |
| calibration_snapshots | Freshness | OK |
| job_records | Jobs | OK |
| alerts, alert_rules | Alerting | OK |
| incidents, incident_alerts | Incidents v1 | OK |
| evidence_snapshots | Evidence metadata | OK |
| collection_schedules | Scheduler config | OK |

**Missing:** `users` table (users in `data/registered_users.json` **SRC** auth.py); audit log table; credential encryption at rest.

---

## 16. Dynamic versus static functionality matrix

| Feature | FE | BE | DB | Real data | Persistent | Complete |
|---------|----|----|-----|-----------|------------|----------|
| Dashboard | Y | Y | Y | Collected/mock | Y | Partial |
| Fleet inventory | Y | Y | Y | Y | Y | Y |
| Per-qubit telemetry | Y | Y | Y | Y | Y | Partial |
| Calibration history | Y | Y | Y | Y | Y | Partial |
| Drift | Y | Y | Y | Y | Y | Partial |
| Queue monitoring | Y | Y | Y | Y | Y | Partial |
| Jobs | Y | Y | Y | Y | Y | Partial |
| Resource health | Y | Y | Y | Computed | Y | Partial |
| Incidents | Y | Y | Y | Y | Y | Partial |
| Alert rules | Y | Y | Y | Y | Y | Y |
| Provider config | Y | Y | partial | Live/stub | .env | Partial |
| Discovery | Y | Y | Y | Y | Y | Y |
| Environment import | Y | Y | file JSON | Import | Y | Partial |
| Reports/export | Y | Y | Y | Y | Y | Partial |
| Auth | Y | Y | JSON file | Y | Y | **Incomplete security** |
| RBAC | partial | partial | N | Header | N | Partial |
| Theme | Y | N | localStorage | N | Y | Y |
| Federated fleet | Y | Y | snapshots | Import | Y | Partial |
| E2E tests | N | N | N | N | N | N |

---

## 17. Quantum technical correctness audit

| Topic | Finding | Severity |
|-------|---------|----------|
| T1/T2 units | Documented µs in health vector | OK **SRC** health_vector.py |
| Health vector H | F_limit, η_cal, δ_cal, C_exec v2 advisory | Partial — constants not lab-tuned |
| GREEN/YELLOW/RED | Missing → UNKNOWN | OK design |
| Fleet T1 mean in SSE/dashboard | Cross-backend average | **Misleading** for mixed modalities |
| Compare | Modality-aware API | OK **SRC** backend_comparison.py |
| Calibration freshness vs quality | Freshness hours only | Do not conflate — mostly OK |
| Quarantine | DB status only | **Not safe** for real QPU routing |
| Gate duration ref | 50 ns fixed | Documented constant |

---

## 18. Authentication and security audit

| Item | Finding | Severity |
|------|---------|----------|
| Login | Fixed env users + JSON registry | P1 |
| Password hash | SHA-256 + salt in auth (**SRC** `_hash_password`) | P1 weak for production |
| Session token | `qtok_*` returned, **never validated** on API | **P0** |
| Register role | User can select **Admin** on register | **P0** auth.py L275–277 |
| Default passwords | `quantum2026` in config defaults | **P0** if exposed |
| CAPTCHA | In-memory store | P2 |
| RBAC | Optional header; off by default | P1 |
| CORS | `*` | P1 |
| Rate limiting | None | P2 |
| Credentials | Written to `.env` plaintext | **P0** ops |
| SQL injection | ORM parameterized | Low risk |
| XSS | React default escaping | **NV** |
| JWT | Not implemented | N/A |

---

## 19. Configuration audit

| Setting | UI | Backend | Persistence | Issues |
|---------|-----|---------|-------------|--------|
| ENABLE_MOCK_DATA | config-status banner | env | .env | Default true |
| Provider tokens | Admin | admin/credentials | .env + os.environ | Plaintext |
| Schedules | Admin | DB | SQLite | Scheduler env gate |
| ENFORCE_RBAC | None | env | env only | Hidden |
| DATABASE_URL | None | env | env | |
| Theme | Top bar | N/A | localStorage | |
| Sidebar collapse | Footer | N/A | localStorage | |

---

## 20. Reports and evidence audit

| Capability | Source | Integrity |
|------------|--------|-----------|
| CSV/HTML/JSON export | `report_generator.py` + DB | **SRC** |
| Evidence ZIP | manifest SHA-256 | **SRC** snapshot_builder |
| Bundle import/export | JSON | Partial |
| Provenance in UI | DataProvenanceBar | **SRC** |

---

## 21. Testing and code quality audit

| Area | Count / finding |
|------|-----------------|
| Pytest | **54 passed** (**RUN**) |
| Frontend tests | **None** |
| E2E | **None** |
| Adapter contracts | mock + 3 vendor mock paths |
| backend/tests | Legacy duplicate **INF** |
| IBM adapter | `print()` error paths may leak info | P2 |
| Duplication | `backend/` vs `app/` | P2 debt |

---

## 22. Reliability and self-observability audit

| Mechanism | Status |
|-----------|--------|
| `/admin/collector-health` | Per-provider last run |
| `/admin/provenance` | Platform lineage |
| SSE staleness fields | Exposed |
| Scheduler status | `/admin/scheduler-status` |
| Silent mock fallback | When ENABLE_MOCK_DATA true | Risk **P1** |

---

## 23–27. Defects, debt, UX, gaps (summary)

**Confirmed defects:** open registration as Admin; API ignores session token; default creds; SSE marketed live vs tick; README wrong stack path.

**Incomplete:** live IonQ; MQTT facility; federated live mesh; PostgreSQL as default prod; role-based nav.

**Technical debt:** monolithic routers, duplicate backend tree, print logging in IBM adapter.

**UX:** no URL deep links; tab proliferation under Telemetry; dark chart tooltips.

---

## 28. Prioritized issue register

| ID | Sev | Category | Summary | Evidence |
|----|-----|----------|---------|----------|
| P0-001 | P0 | Security | Registration allows `Admin` role | auth.py L275–277 |
| P0-002 | P0 | Security | API does not validate `qtok_*` session | auth.py, api.js |
| P0-003 | P0 | Security | Default admin password in config | config.py |
| P0-004 | P0 | Ops | Provider secrets written plaintext `.env` | admin.py |
| P0-005 | P0 | Misleading ops | Quarantine does not affect real QPU | health.py |
| P1-001 | P1 | Auth | RBAC off by default; header-only | rbac.py |
| P1-002 | P1 | Data honesty | SSE is DB tick not live vendor stream | events.py |
| P1-003 | P1 | Docs | README backend/TSX mismatch | README vs repo |
| P1-004 | P1 | Providers | IonQ adapter mock-only | ionq_adapter.py |
| P1-005 | P1 | UX | No deep links to console sections | App.jsx |
| P2-001 | P2 | UX | LiveTelemetry chart light tooltip in dark mode | LiveTelemetry.jsx |
| P2-002 | P2 | Debt | Obsolete `backend/` tree | backend/app/main.py |
| P3-001 | P3 | Polish | IST clock vs UTC in backend timestamps | mixed |

---

## 29. Current product maturity assessment

| Criterion | Rating (1–5) | Notes |
|-----------|--------------|-------|
| Backend completeness | 4 | Broad API surface |
| Frontend completeness | 3.5 | Many pages, shell navigation |
| Production security | 1.5 | Critical gaps |
| Live multi-vendor | 2 | Mock-heavy |
| Enterprise UX | 2.5 | Improving, not NOC-grade |
| Test confidence | 3 | Backend unit only |
| National deployment readiness | 2 | Air-gap docs exist; auth blocks |

**Overall:** Strong **engineering demo / pilot**; weak **production governance**.

---

## 30. Questions requiring clarification

1. Is `backend/` officially deprecated?
2. Production target: PostgreSQL only or SQLite allowed?
3. Should mock mode ever be enabled in national deployment?
4. Is client-side Admin gate sufficient for any environment?
5. Which providers must be **live-verified** for sign-off?

---

## 31. Repository evidence and references

| Artifact | Path |
|----------|------|
| Main entry | `app/main.py` |
| Models | `app/models/entities.py` |
| Frontend shell | `frontend/src/App.jsx` |
| API client | `frontend/src/services/api.js` |
| Auth | `app/api/auth.py` |
| SSE | `app/api/events.py` |
| Health model | `app/analytics/health_vector.py` |
| Program worklog | `.planning/qtelescope-national/WORKLOG.md` |
| Tests | `tests/` (54 tests) |

---

*End of audit report. Generated read-only; no application source was modified during this audit.*
