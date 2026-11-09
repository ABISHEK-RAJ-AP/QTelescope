# Q-TeleScope — Enterprise maturity programme

**Owner:** Platform engineering  
**Evidence date:** 2026-11-09  
**Scope:** `frontend/` + `app/` only (not QRP, Govern, qniverse unless shared API)  
**Authoritative architecture:** [PLATFORM_STATUS_AND_WORKFLOWS.md](PLATFORM_STATUS_AND_WORKFLOWS.md)  
**Release gate:** [QA/MASTER_RELEASE_CHECKLIST.md](QA/MASTER_RELEASE_CHECKLIST.md)

## Guiding principles (non-negotiable)

1. **No misleading data** — measured / derived / estimated / simulated / stale must be visible.
2. **No dead-end workflows** — backend → calibration → telemetry → jobs → alerts → incidents → evidence must link.
3. **Every operational action traceable** — who, what, when, outcome, prior state.

## Programme verdict

| Milestone | Target | Current (2026-11-09) |
| --- | --- | --- |
| Enterprise UI/ops polish | Phase 1–3 complete | **Sprint 2 in progress** (~28% of master checklist) |
| Production security gate | Phase 2 complete | **Open P1s** (secrets, MFA at rest, reset mail, E2E) |
| Quantum differentiation | Phase 4 | **Partial** (provenance hooks exist; quality states incomplete) |
| Go-live rehearsal | Phase 5 | **Not started** |

**Do not declare production-ready** until [QA/PRODUCTION_READINESS_REPORT.md](QA/PRODUCTION_READINESS_REPORT.md) gate passes **and** master checklist has zero open **FAIL** on security/testing rows.

---

## Sprint map (12-week plan)

| Sprint | Phase | Weeks | Theme | Exit criteria |
| --- | --- | --- | --- | --- |
| **S1** | 1 | 1–2 | Foundation UX + reliability | Tokens, loading/error consistency, command palette, request IDs, TeleScope Playwright smoke, checklist baselined |
| **S2** | 1 | 2–3 | Page consistency pass | All 28 routes audited; shared table/form patterns; Vitest infra; E01–E06 Playwright |
| **S3** | 2 | 3–4 | Security blockers | Secrets, RBAC enforced, MFA encryption, session hardening, backup restore drill |
| **S4** | 3 | 5–7 | Operator workflows | Notifications, shift handover, maintenance windows, alert correlation, collector history |
| **S5** | 4 | 8–10 | Quantum depth | Provenance, calibration revisions, modality profiles, topology accuracy, workload epoch |
| **S6** | 5 | 11–12 | Release validation | Full E2E, visual regression, a11y, load/resilience, UAT sign-off |

---

## Sprint 1 — deliverables (this repo wave)

### Shipped in code (verify on `main`)

| Item | Evidence |
| --- | --- |
| Enterprise programme docs | This file + `MASTER_RELEASE_CHECKLIST.md` |
| Design token aliases | `frontend/src/styles/design-tokens.css` |
| Structured API errors + `X-Request-Id` | `app/core/request_id.py`, `app/main.py`, `app/core/api_auth.py` |
| Client-friendly API errors | `frontend/src/lib/apiErrors.js`, `services/api.js` |
| Error UI reference IDs | `ErrorState.jsx` |
| Global command palette (Ctrl/Cmd+K) | `CommandPalette.jsx` (RBAC-filtered nav) |
| SSE reconnect without chart teardown | `LiveTelemetry.jsx` |
| TeleScope Playwright smoke spec | `tests/e2e/telescope-smoke.spec.ts` |
| Request ID pytest | `tests/test_request_id.py` |

### Sprint 2 — in progress

| Item | Evidence |
| --- | --- |
| Vitest + RTL | `frontend/vitest.config.js`, `npm test` |
| Shared enterprise table | `EnterpriseDataTable.jsx` |
| Shared form field chrome | `AppFormField.jsx` |
| Route audit (28 routes) | [QA/SPRINT2_ROUTE_AUDIT.md](QA/SPRINT2_ROUTE_AUDIT.md) |
| Playwright E01–E10 | `telescope-journeys.spec.ts`, `telescope-journeys-ops.spec.ts` |
| Platform Health table | `PlatformHealth.jsx` → `EnterpriseDataTable` |
| E2E captcha bypass (non-prod) | `E2E_CAPTCHA_BYPASS=1`, code `BYPASS`, `test_e2e_captcha_bypass.py` |

### Sprint 1 backlog (still open)

- Full Playwright journeys E07–E24.
- Saved table views, notification centre, shift handover.
- Metric-level provenance and quality enums end-to-end.
- TanStack Query adoption / `api.js` split (optional refactor).
- Live readiness scorecard page (admin).

---

## Dimension owners (8 blueprint areas)

| # | Dimension | Primary artefacts | Sprint focus |
| --- | --- | --- | --- |
| 1 | UI/UX | Design tokens, shells, Skeleton, ErrorState | S1–S2 |
| 2 | Quantum ops | Calibration, drift, topology, provenance | S4–S5 |
| 3 | Backend/API | Routers, errors, collectors, SSE | S1–S3 |
| 4 | Database | Alembic, retention, backups | S3, S6 |
| 5 | Security/RBAC | auth, sessions, audit | S3 |
| 6 | Incidents/automation | alerts, incidents, runbooks | S4 |
| 7 | Admin/enterprise | admin sections, onboarding | S3–S4 |
| 8 | Testing/deploy | pytest, Playwright, compose, VM scripts | S1–S6 |

---

## Work loop (every sprint)

1. Inspect code and update checklist row status with evidence.
2. Pick one P0/P1 row not **PASS**.
3. Smallest shared fix (component/util, not one-off page hack).
4. Add or extend test (pytest or Playwright).
5. Update `DEFECT_REGISTER.md` / readiness report.
6. Repeat until sprint exit criteria met — **do not mark PASS without verification**.

---

## Related documents

- [QA/MASTER_RELEASE_CHECKLIST.md](QA/MASTER_RELEASE_CHECKLIST.md) — 93-item master QA list with live status.
- [QA/PRODUCTION_READINESS_REPORT.md](QA/PRODUCTION_READINESS_REPORT.md) — go-live verdict.
- [QA/FRONTEND_INTERACTION_MATRIX.md](QA/FRONTEND_INTERACTION_MATRIX.md) — control-level QA.
- [RBAC_AND_IDENTITY.md](RBAC_AND_IDENTITY.md) — roles and permissions.
