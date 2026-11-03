# Q-TeleScope — Testing and Acceptance Checklist

**Current RUN:** 84 backend pytest (`USE_ALEMBIC=false PYTHONPATH=. pytest tests/`), 0 frontend unit tests, 0 Playwright E2E (**SRC** — re-verified 2026-10-31 post IMP-P6)

Legend: **[A]** covered by automated test in CI/dev | **[M]** manual / pilot sign-off still required

---

## Phase 0 acceptance (IMP-P0 — pilot security)

### Security

- [x] [A] Register cannot create Admin role — `tests/test_sessions.py`
- [x] [A] API rejects requests without valid session when `REQUIRE_API_AUTH=true` — `tests/test_sessions.py`
- [x] [A] RBAC enforced on mutators when `ENFORCE_RBAC=true` — `tests/test_rbac.py`, `tests/test_incidents_p3.py`
- [x] [A] Bootstrap default password block — `tests/test_bootstrap_security.py`
- [x] [A] Provider token not returned in GET credentials — code review / admin API
- [x] [A] Rate limit on auth — `tests/test_rate_limit.py`

### Data honesty

- [x] [A/M] Live Telemetry copy = platform DB refresh (not vendor stream) — UI + SSE payload
- [x] [A/M] Provenance bar reflects mock mode — `DataProvenanceBar`, `/admin/provenance`
- [x] [M] STUB provider save shows STUB/truth label — Admin `truth_label` (IMP-P5)

### Quarantine

- [x] [M] UI states advisory local flag — ResourceHealth + API response fields
- [x] [A] Audit on quarantine/release — `record_audit` in health API (jsonl + DB)

### Regression

- [x] [A] `pytest tests/` — **84 passed** (target was ≥54)
- [x] [A] Session + RBAC + incidents tests present (supersedes planned `test_auth_session.py` names)

---

## Phase 1 acceptance (IMP-P1)

- [x] [A/M] URL `/app/operations` loads Operations Centre — `appNav.js` + App shell
- [x] [A/M] Deep link restores section/tab — `/app/telemetry/*`, `/app/backends/details/:id`
- [ ] [M] axe-core: 0 critical on Dashboard, Login, Operations — not automated
- [x] [M] Dark mode chart tooltips — LiveTelemetry + Dashboard charts
- [x] [A] README root `app/` startup

**Deferred:** URL-persisted site/backend/time range; modal focus trap on Admin rule dialog.

---

## Phase 2 acceptance (IMP-P2)

- [x] [A/M] No cross-modality fleet T1 KPI — `t1_by_modality`, dashboard modality strip
- [x] [A/M] Jobs: sort + filter + pagination — `JobMonitoring.jsx`
- [x] [A] Compare blocks bad modality mixes — `tests/test_backend_comparison.py`, API

- [x] [A] Backend inventory sort/page — `useTableKit`
- [x] [A] Metric explorer — `/app/telemetry/metrics`, `/metrics/registry`

---

## Phase 3 acceptance (IMP-P3)

- [ ] [M] Operator E2E: alert → incident → evidence (scripted)
- [x] [A/M] Platform health — collectors, DLQ, circuit — `/operations/platform-health`
- [x] [A] Evidence download auth — `tests/test_incidents_p3.py` + Bearer blob download

- [x] [A/M] Operator default landing `/app/operations` — Login + deployment profile
- [x] [A] Incident audit + comments — API + jsonl

---

## Phase 4 acceptance (IMP-P4)

- [x] [A/M] PostgreSQL path documented + Alembic 0004 — `docs/DATABASE_POSTGRES.md`, compose
- [x] [A] Retention deletes old telemetry — `tests/test_telemetry_retention.py`
- [x] [M] Backup scripts present — `scripts/backup_*.sh`, `docs/DATABASE_BACKUP.md` (DR drill manual)

- [x] [A] Users/audit DB tables + JSON migrate — `tests/test_user_store.py`

---

## Phase 5 acceptance (IMP-P5)

- [x] [A/M] Catalog truth labels LIVE/MOCK_ONLY/STUB/etc. — Admin credentials API + UI
- [x] [A] Adapter contract tests — `tests/test_adapter_contract.py`
- [x] [A] Collector circuit + DLQ — `tests/test_provider_truth_p5.py`

- [x] [A] MQTT NOT_BUILT boundary — `tests/test_provider_truth_p5.py`, `docs/FACILITY_MQTT.md`

---

## Phase 6 acceptance (IMP-P6)

- [x] [A/M] Air-gap assets + preflight — `tests/test_airgap_preflight.py`, `deployment/airgap/preflight.sh`
- [x] [A] Signed snapshot verify — `tests/test_federation_signing.py`

- [x] [A] Governance doc — `docs/FEDERATION_GOVERNANCE.md`
- [x] [A] Phase map — `.planning/qtelescope-national/NATIONAL_CHECKLIST_PHASE_MAP.md`

---

## Non-functional (recommended — still open)

| Test | Tool | Phase | Status |
|------|------|-------|--------|
| API load | k6/locust | 4+ | Not started |
| Frontend E2E | Playwright | 1+ | Not started |
| a11y | axe, manual keyboard | 1+ | Partial (skip-link, focus-visible) |
| Security scan | bandit, pip-audit | 0+ | Not in CI |
| IBM live verify | `GET /admin/adapters/verification` | 5 | Optional secrets |

---

## Quality gates (proposed — require approval)

| Gate | Target |
|------|--------|
| Backend pytest | ≥84 pass on main |
| OpenAPI contract smoke | `tests/test_openapi_contract.py` |
| No Admin self-register | always |

See also `QTelescope_Implementation_Roadmap.md` (IMP-P0–P6 complete).
