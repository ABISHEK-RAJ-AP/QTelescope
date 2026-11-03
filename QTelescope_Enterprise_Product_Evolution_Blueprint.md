# Q-TeleScope — Enterprise Product Evolution Blueprint

**Version:** 1.0 (planning)  
**Date:** 2026-10-31  
**Repository:** `/home/boss/Desktop/Quantum_Monitoring-main`  
**Git commit:** NV (not a git repo or no commit in environment)  
**Task type:** Planning and specification only — **no application source modified**

### Satellite documents

| Document | Purpose |
|----------|---------|
| [QTelescope_Page_and_Feature_Matrix.md](./QTelescope_Page_and_Feature_Matrix.md) | Page/feature crosswalk |
| [QTelescope_Implementation_Roadmap.md](./QTelescope_Implementation_Roadmap.md) | Phased implementation |
| [QTelescope_UX_Design_System_Spec.md](./QTelescope_UX_Design_System_Spec.md) | Tokens, shell, charts |
| [QTelescope_API_and_Data_Model_Recommendations.md](./QTelescope_API_and_Data_Model_Recommendations.md) | API + schema |
| [QTelescope_Testing_and_Acceptance_Checklist.md](./QTelescope_Testing_and_Acceptance_Checklist.md) | Gates per phase |
| [QTelescope_Repository_and_Product_Audit.md](./QTelescope_Repository_and_Product_Audit.md) | Prior baseline (re-verified below) |

### Re-verification summary (2026-10-31)

| Check | Result | Tag |
|-------|--------|-----|
| Canonical backend | `app/main.py` mounts 24 routers | SRC |
| Legacy tree | `backend/app/main.py` — 11 routers only | SRC |
| Frontend pages | 25 JSX modules in `frontend/src/pages/` | SRC |
| OpenAPI paths | 53 at `/api/v1/openapi.json` | RUN |
| Pytest | 54 passed, `USE_ALEMBIC=false PYTHONPATH=.` | RUN |
| Browser UI audit | Not performed this session | NV |
| Live provider APIs | Not exercised (no credentials) | NV |

Prior audit findings **confirmed SRC** unless noted: client-only auth, Admin on register (`RegisterPage.jsx` L150, `auth.py` L275–277), default credentials (`config.py`), plaintext `.env` token writes (`admin.py`), SSE DB tick (`events.py` L54–60), state nav (`App.jsx`), optional RBAC (`rbac.py`).

---

## 1. Executive summary

Q-TeleScope already implements a **wide observability surface** (fleet, telemetry history, health vector, incidents, evidence, federation snapshots, facility import). The next evolution must **not** add decorative dashboards. It must make the platform **coherent, secure, accessible, and operationally honest**.

**Strategic shift:**

1. **Truth layer** — mock/sim/stub/live/stale visible everywhere; fix misleading "live" SSE and STUB provider UX.  
2. **Trust layer** — server-side authN/authZ ([NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final)), secrets hygiene, audit persistence.  
3. **Operator layer** — URL-based IA, Operations Centre as hub, incident/evidence workflows.  
4. **Data layer** — PostgreSQL prod path, retention, collection run traceability.  
5. **Integration layer** — provider truth matrix; live verification harness; facility/MQTT boundary.

**Do not implement** until this blueprint is reviewed. Follow [QTelescope_Implementation_Roadmap.md](./QTelescope_Implementation_Roadmap.md) phases; update `.planning/qtelescope-national/WORKLOG.md` as phases complete.

---

## 2. Product vision and scope

### 2.1 Positioning statement

**Q-TeleScope** is C-DAC’s **quantum infrastructure observability and operations console** for heterogeneous QPUs, simulators, and supporting classical/facility systems. It helps operators and researchers **see inventory, telemetry, calibration freshness, queues, jobs, health, incidents, and evidence** — not submit circuits.

### 2.2 Personas (justified by current UI)

| Persona | Justification | Default landing (proposed) |
|---------|---------------|----------------------------|
| Platform Administrator | Admin page, creds, schedules, rules | Administration → Platform Health |
| Quantum Operator | Quarantine, incidents, ops centre | Operations Centre |
| Reliability/SRE | Collectors, provenance, anomalies | Platform Health + Operations |
| Researcher / Analyst | Compare, drift, read-only | Dashboard or Backends |
| Auditor | Evidence export | Reports / Evidence |

Facility Administrator — **defer** until MQTT/facility live path exists (currently import-only **SRC**).

### 2.3 Vocabulary (canonical → current drift)

| Term | Definition | Drift found |
|------|------------|-------------|
| Backend | Registered QPU/sim resource in DB | Consistent |
| Provider | Vendor integration (IBM, etc.) | UI lists STUB as peers **SRC** catalog |
| Live | Measurement from vendor API in this collection run | SSE "live" = DB poll **misuse** |
| Simulated / Mock | `ENABLE_MOCK_DATA` or mock adapter | Partial labeling |
| Freshness | Age since calibration/telemetry | OK in API |
| Health / Readiness | Advisory H vector v2 | UI may imply authority |
| Incident vs Alert | Incident groups alerts | Both exist; workflow partial |
| Evidence | ZIP + hashes | Not WORM/legal hold |
| Provenance | `telemetry_source`, `/admin/provenance` | Bar exists; not all pages |

---

## 3. Proposed information architecture

Map from **current** (`App.jsx` groups) → **target** (candidate):

| Target group | Current pages | Action |
|--------------|---------------|--------|
| **Overview** | Dashboard, Operations | Merge KPIs; Ops Centre primary for operators |
| **Quantum fleet** | Inventory, Details, Qubits, Topology | Add URL routes; rename Qubits → Qubit Explorer |
| **Observability** | Live, Trends, Cal, Drift, Timeline, Compare, Anomalies, Replay, Metrics | Split "Data quality" from Live; rename Live → Platform stream |
| **Reliability** | Resource Health, Alerts, Incidents | Single Alerts & Incidents entry (remove duplicate Resources tab) |
| **Workload** | Jobs, Queues | Keep |
| **Infrastructure** | Environment, Classical (in Details) | Expand Phase 5 |
| **Evidence** | Reports | Subnav: Export, Snapshots, Lookup (research/ask) |
| **Administration** | Admin | Split Platform Health vs Integrations |
| **Research** | Novelty audit API only | Defer UI or admin-only |

**Deep linking (mandatory Phase 1):** `/app/:section/:tab?backend=&from=&to=` via React Router nested routes.

**Responsive:** Desktop-first NOC; tablet = read-only ops + incidents; mobile = status + ack only (explicit scope).

Full page list: [QTelescope_Page_and_Feature_Matrix.md](./QTelescope_Page_and_Feature_Matrix.md).

---

## 4. Page-by-page specification (condensed)

Each page follows template; **NV** = UI not visually inspected.

### 4.1 Login (`LoginPage.jsx`, `/login`)

| Field | Value |
|-------|-------|
| Persona | All |
| APIs | POST `/auth/login`, captcha |
| Current | localStorage `quantum_user`; token unused |
| Problems | No server session; no expiry UX |
| Proposed | Cookie session + redirect; session expiry modal |
| Action | **Rework** |
| Tests | Auth E2E Phase 0 |

### 4.2 Register (`RegisterPage.jsx`, `/register`)

| Problems | Admin in `<select>` **P0** |
| Action | **Rework** — Operator/Researcher only; Admin bootstrap |

### 4.3 Dashboard (`DashboardHome.jsx`, `home`)

| APIs | summary, backends, alerts, jobs, queues, calibration, coherence |
| Action | **Improve** — modality-safe KPIs; link to Ops Centre exceptions |

### 4.4 Operations Centre (`OperationsCentre.jsx`)

| Action | **Improve** → primary operator workspace Phase 3 |

### 4.5 Live Telemetry (`LiveTelemetry.jsx`)

| Data | SSE 5s DB aggregates **SRC** |
| Action | **Rework** copy + chart tokens; optional rename tab |

### 4.6 Resource Health (`ResourceHealth.jsx`)

| Action | **Rework** quarantine labels; confirm + audit |

### 4.7 Administration (`AdministrationPage.jsx`)

| Action | **Rework** STUB honesty; secrets; platform health links |

### 4.8 Reports (`ReportsPage.jsx`)

| Action | **Improve** evidence RBAC; rename Q&A to "Evidence lookup" |

*(Remaining pages: Preserve/Improve per matrix — no removal without user approval.)*

---

## 5. Role-based permissions (target)

| Action | Platform Admin | Operator | Researcher | Auditor |
|--------|----------------|----------|------------|---------|
| View telemetry | Y | Y | Y | Y |
| Ack alert | Y | Y | N | N |
| Quarantine (advisory) | Y | Y | N | N |
| Save provider creds | Y | N | N | N |
| Alert rules CRUD | Y | N | N | N |
| Evidence create | Y | Y | N | Y |
| Evidence download | Y | Y | Y | Y |
| Federated import | Y | N | N | N |

Enforce server-side; align with extended `rbac_audit` routes Phase 0.

---

## 6. End-to-end workflows (abbreviated)

1. **Degraded backend:** Ops Centre → Backend Details → Cal timeline + Drift → Anomalies → Incident sync → Evidence snapshot.  
2. **Admin integration:** Providers → test connection → collector-health → provenance.  
3. **Auditor:** Reports → list snapshots → verify manifest hash → download (authZ).

Each step needs audit events Phase 0–3.

---

## 7. Frontend architecture (recommendations)

| Topic | Current SRC | Recommendation |
|-------|-------------|----------------|
| Routing | State in `App.jsx` | Nested React Router |
| API | `api.js` fetch | + OpenAPI types; send session cookie |
| State | useState per page | TanStack Query for server state (evaluate bundle) |
| SSE | LiveTelemetry only | Document semantics; reconnect backoff |
| Tests | None | Vitest + Playwright Phase 1 |

---

## 8. Backend architecture (recommendations)

- Thin routers → `services/` (auth, evidence, collection already partial).  
- Collector: circuit breaker, `failed_collections` table Phase 5.  
- Structured logging + correlation ID middleware Phase 1.  
- Rate limiting: `slowapi` or middleware Phase 0.

---

## 9. Provider integration truth matrix

| Provider | Adapter | Status | Tag |
|----------|---------|--------|-----|
| IBM | `ibm_adapter.py` | HTTP IAM + discovery; mock fallback | LIVE_IMPLEMENTED_UNVERIFIED |
| Rigetti | `rigetti_adapter.py` | QCS ISA + mock | LIVE_IMPLEMENTED_UNVERIFIED |
| IonQ | `ionq_adapter.py` | Mock paths only in file | MOCK_ONLY |
| C-DAC/on-prem | `onprem_adapter.py` | Mock if enabled | MOCK_ONLY / LIVE_IMPLEMENTED_UNVERIFIED |
| AWS/Azure/Google/… | `catalog.py` | Store only | STUB |
| PARAM classical | `infra/classical_metrics.py` | Simulated metrics | MOCK_ONLY |

Never show STUB as "synchronized live" in UI.

---

## 10. Quantum domain correctness

- **Health vector** (`health_vector.py` **SRC**): Advisory v2; constants not lab-validated — label **Research/Advisory** in UI.  
- **Cross-modality means:** Forbidden in KPIs without compatibility flag.  
- **Compare:** Backend comparison API modality-aware — surface constraints in UI.  
- **Quarantine:** DB flag only — **never** imply IBM queue exclusion.

---

## 11. Security (P0 first)

Re-verified issues: P0-001..005 from audit. Remediation in Roadmap Phase 0.  
Threat model: token theft, privilege escalation via register, `.env` exposure, forged import JSON, fake healthy collector state.

---

## 12. Platform self-observability

Consolidate existing `/admin/collector-health`, `/admin/provenance`, `/admin/scheduler-status`, `/admin/rbac-audit` into **Admin → Platform Health** UI Phase 3.

---

## 13. Federation

Current: snapshot import (`federated.py` **SRC**) — **not** live mesh. Roadmap Phase 6 for signing + governance.

---

## 14. Accessibility

Target [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/). Page checklist in UX spec; manual keyboard + axe Phase 1. Not claiming compliance until tested.

---

## 15. Master issue register (sample)

| ID | Area | Evidence | Change | Priority |
|----|------|----------|--------|----------|
| REG-001 | Security | RegisterPage L150 | Remove Admin option | P0 |
| AUTH-001 | Security | auth.py, api.js | Validate session | P0 |
| SSE-001 | Honesty | events.py | Rename + staleness UX | P0 |
| QUAR-001 | Safety | health.py | Advisory labeling | P0 |
| SEC-001 | Secrets | admin.py | No plaintext .env | P0 |
| NAV-001 | UX | App.jsx | URL routes | P1 |
| DB-001 | Data | entities | Retention + PG prod | P1 |
| IONQ-001 | Provider | ionq_adapter.py | Live or gate | P2 |

Full register grows during implementation; track in WORKLOG.

---

## 16. Phased roadmap

See [QTelescope_Implementation_Roadmap.md](./QTelescope_Implementation_Roadmap.md) — Phases 0–6.

**Implementation order:** Phase 0 → 1 → 2 → 3 → 4 (prod) with 5–6 as national program.

---

## 17. Decisions requiring C-DAC / user clarification

1. Production DB: PostgreSQL mandatory?  
2. Mock mode allowed in national deploy?  
3. Is advisory quarantine sufficient indefinitely?  
4. Target for IonQ: live API or explicit mock-only product scope?  
5. Federation: snapshot-only vs mesh timeline?  
6. Retention periods ( governance )?

---

## 18. External references

| Source | Application to Q-TeleScope |
|--------|----------------------------|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | a11y target for NOC UI |
| [WCAG 2.2 What's New](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) | Focus visible, target size |
| [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final) | Verify every API request; no implicit trust |
| [NIST SP 800-207A](https://csrc.nist.gov/pubs/sp/800/207/a/final) | App-level access control |
| [OTel Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/) | Metric naming/metadata discipline |
| [OTel Metrics Conventions](https://opentelemetry.io/docs/specs/semconv/general/metrics/) | Units, attributes, aggregation caution |

---

## 19. Evidence appendix

| Symbol | Path |
|--------|------|
| Main | `app/main.py` |
| Auth | `app/api/auth.py` |
| SSE | `app/api/events.py` |
| RBAC | `app/core/rbac.py` |
| Shell | `frontend/src/App.jsx` |
| API client | `frontend/src/services/api.js` |
| Register | `frontend/src/pages/RegisterPage.jsx` |

---

**End of blueprint.** Await user approval before Phase 0 implementation.
