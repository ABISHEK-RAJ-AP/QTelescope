# Q-TeleScope master release checklist

**Tracker only — not a production score.** A single critical **FAIL** in security still blocks release.

**Last updated:** 2026-11-09  
**Summary:** **25 PASS** · **32 PARTIAL** · **7 FAIL** · **29 NOT VERIFIED**

Programme: [../ENTERPRISE_MATURITY_PROGRAM.md](../ENTERPRISE_MATURITY_PROGRAM.md)

---

## Status legend

| Status | Meaning |
| --- | --- |
| PASS | Verified in repo or automated test this cycle |
| PARTIAL | Exists but incomplete or not verified on all routes |
| FAIL | Missing or known broken for enterprise gate |
| NOT VERIFIED | Not executed this cycle (needs browser/VM/prod env) |
| N/A | Out of TeleScope scope or accepted debt |

---

## Frontend foundation (6 / 15 PASS)

_Sprint 2:_ route audit [SPRINT2_ROUTE_AUDIT.md](SPRINT2_ROUTE_AUDIT.md); shared `EnterpriseDataTable`, `AppFormField`.

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| F01 | All 28 routes load without console errors | NOT_VERIFIED | No full browser sweep |
| F02 | Unified design system / shared components | PARTIAL | `design-tokens.css`, `EnterpriseDataTable` on Platform Health |
| F03 | Consistent typography, spacing, hierarchy | PARTIAL | `index.css` tokens; uneven page CSS |
| F04 | Cards/grids align correctly | NOT_VERIFIED | Visual QA blocked |
| F05 | Loading skeletons on API-driven UI | PARTIAL | `BoneyardSkeleton`, many pages |
| F06 | Consistent error / empty / offline states | PARTIAL | `ErrorState`, `EmptyState`; not every page |
| F07 | Inline form validation | PARTIAL | Admin/settings; not universal |
| F08 | Confirm dialogs for destructive actions | PARTIAL | Logout, admin, alerts; gaps remain |
| F09 | Toast consistency | PASS | `ToastHost` + react-toastify |
| F10 | Breadcrumbs / deep links | PASS | `appNav.js`, `PageHeader` |
| F11 | Global search / command palette | PARTIAL | Ctrl+K palette (nav only); no entity search |
| F12 | Keyboard nav / focus | PARTIAL | Modals; full app not audited |
| F13 | Light/dark themes | PASS | `ThemeProvider` |
| F14 | Responsive 9 viewports | NOT_VERIFIED | Matrix exists; no screenshots |
| F15 | Structured API errors in UI | PASS | `apiErrors.js` + request id in `ErrorState` |

---

## Interaction and usability (4 / 12 PASS)

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| U01 | Every button has working action | NOT_VERIFIED | Interaction matrix incomplete |
| U02 | Dropdowns / selects work | NOT_VERIFIED | |
| U03 | Tabs load correct content | PARTIAL | App shell routing |
| U04 | Modals validate correctly | PARTIAL | ConfirmDialog pattern |
| U05 | Table sort/filter expectations | PARTIAL | `EnterpriseDataTable`; queue backend URL filter |
| U06 | Bulk actions permissioned | PARTIAL | Alerts bulk |
| U07 | Search + pagination | PARTIAL | Alerts, jobs |
| U08 | Filter persistence | PARTIAL | URL scope on some pages |
| U09 | Refresh preserves state | PARTIAL | Dashboard layout localStorage |
| U10 | No duplicate form submit guards | PARTIAL | Some forms only |
| U11 | No dead links | NOT_VERIFIED | |
| U12 | Browser back/forward | PASS | `appNav` canonical paths |

---

## Backend and APIs (5 / 13 PASS)

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| B01 | Consistent API error schema | PARTIAL | HTTPException + 422 envelope; not all paths |
| B02 | Auth on protected routes | PARTIAL | `REQUIRE_API_AUTH` env-gated |
| B03 | RBAC on sensitive routes | PARTIAL | `ENFORCE_RBAC` env-gated |
| B04 | Pagination / query limits | PARTIAL | Many list endpoints |
| B05 | Timeout / retry policies | FAIL | Client retry limited |
| B06 | Worker health checks | PARTIAL | Platform health page |
| B07 | Collector execution history | FAIL | DLQ only; no full history UI |
| B08 | DLQ / retry verified | PARTIAL | Admin collectors |
| B09 | SSE reconnect | PARTIAL | LiveTelemetry reconnect; no Last-Event-ID |
| B10 | Provider failure visibility | PARTIAL | Admin integrations |
| B11 | Structured logging + correlation ID | PARTIAL | `X-Request-Id` middleware |
| B12 | Idempotent sensitive ops | NOT_VERIFIED | |
| B13 | API performance budgets | NOT_VERIFIED | |

---

## Database and data quality (3 / 12 PASS)

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| D01 | Postgres production config | NOT_VERIFIED | Env-dependent |
| D02 | Alembic on clean DB | PARTIAL | Migrations present; CI uses SQLite |
| D03 | FK / unique constraints | PASS | ORM models |
| D04 | Time-series indexes | PARTIAL | Performance migrations exist |
| D05 | Retention / archival | FAIL | Not implemented |
| D06 | Backup restore tested | NOT_VERIFIED | Docs only |
| D07 | No destructive history delete | PARTIAL | Soft patterns vary |
| D08 | Telemetry provenance | PARTIAL | `provenance.py`; UI incomplete |
| D09 | Quality state distinction | FAIL | Enum not end-to-end |
| D10 | Stale/partial/conflict states | FAIL | |
| D11 | Calibration revision history | PARTIAL | Snapshots table |
| D12 | Immutable audit records | PARTIAL | `audit_events` |

---

## Authentication and security (6 / 14 PASS)

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| S01 | Block default bootstrap passwords | PARTIAL | Opt-in `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS` |
| S02 | Secrets rotated | FAIL | Demo `.env` still possible |
| S03 | Password hashing | PASS | bcrypt/argon patterns in auth |
| S04 | MFA secrets encrypted at rest | FAIL | QT-07 open |
| S05 | Password reset delivery | FAIL | QT-08 no SMTP |
| S06 | Session expiry / revocation | PASS | Server TTL + client guard + logout confirm |
| S07 | CSRF/XSS tested | NOT_VERIFIED | Headers middleware only |
| S08 | TLS / security headers | PARTIAL | `SecurityHeadersMiddleware` |
| S09 | CORS restricted | PARTIAL | Prod warning if empty |
| S10 | Rate limiting | PARTIAL | Redis or in-memory |
| S11 | LDAP / SSO reviewed | PARTIAL | LDAP bind only |
| S12 | RBAC matrix vs API | PARTIAL | Tests exist; not full matrix |
| S13 | Audit privileged actions | PARTIAL | Partial event coverage |
| S14 | Dependency scans | NOT_VERIFIED | |

---

## Quantum operational features (2 / 13 PASS)

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| Q01 | Live vs simulated distinguished | PARTIAL | Mock env flags; UI labels incomplete |
| Q02 | Provider capability coverage | PARTIAL | Metrics coverage page |
| Q03 | Explained backend health | PARTIAL | Resource health engine |
| Q04 | Policy-aware calibration freshness | PARTIAL | Thresholds in config |
| Q05 | Per-qubit / gate traceability | PARTIAL | Backend workspace |
| Q06 | Topology from real metadata | PARTIAL | Topology explorer |
| Q07 | Drift methodology shown | PARTIAL | Drift page copy |
| Q08 | Jobs linked to backend state | PARTIAL | Navigation links |
| Q09 | Alert correlation | FAIL | Not productized |
| Q10 | Incident ownership / SLA | PARTIAL | Assignment fields |
| Q11 | Facility telemetry sourcing | PARTIAL | Environment page |
| Q12 | Evidence hash verification | PARTIAL | Reports page |
| Q13 | Workload–calibration reconstruction | FAIL | Not implemented |

---

## Testing and deployment (4 / 14 PASS)

| ID | Item | Status | Notes |
| --- | --- | --- | --- |
| T01 | Frontend unit tests | PASS | `npm test` — Vitest (apiErrors, useTableKit, EnterpriseDataTable) |
| T02 | Backend pytest | PASS | 190 passed, 2 skipped (2026-11-09) |
| T03 | Playwright E2E suite | PARTIAL | E01–E24 scripted (`telescope-journeys*.spec.ts`); VM green run pending |
| T04 | Permission combination tests | PARTIAL | RBAC tests partial |
| T05 | Visual regression | NOT_VERIFIED | |
| T06 | Responsive screenshots | NOT_VERIFIED | |
| T07 | Accessibility audit | NOT_VERIFIED | a11y shell exists |
| T08 | Load / stress | NOT_VERIFIED | |
| T09 | Failure recovery tests | NOT_VERIFIED | |
| T10 | Production env validated | NOT_VERIFIED | `.env.production.example` |
| T11 | Deployment rollback | NOT_VERIFIED | |
| T12 | Backup restoration | NOT_VERIFIED | |
| T13 | Ops monitoring for platform | FAIL | No OTel/Prometheus shipped |
| T14 | UAT sign-off | NOT_VERIFIED | |

---

## How to update this file

After each sprint: change row status only with **evidence** (test name, PR, screenshot path, VM command output). Bump summary counts. Link defects in [DEFECT_REGISTER.md](DEFECT_REGISTER.md).
