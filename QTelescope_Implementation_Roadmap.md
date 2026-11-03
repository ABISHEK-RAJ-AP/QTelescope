# Q-TeleScope — Implementation Roadmap

**Status:** Planning approved pending user review | **No code changes in blueprint phase**

Dependency-aware phases. Complete each phase before marking WORKLOG carry-forward **COMPLETE**.

---

## Phase 0 — Product truth and safety (P0)

**Goal:** Trustworthy ops semantics + security baseline.

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 0.1 | Server-side sessions (validate on all protected routes) | Unauthenticated API → 401; token rotation |
| 0.2 | Registration: no self-serve Admin; bootstrap admin only | Register cannot set Admin |
| 0.3 | Remove/default rotate dev credentials; document bootstrap | No default passwords in prod profile |
| 0.4 | Secrets: vault or encrypted store; stop plaintext `.env` writes for tokens | Cred save uses approved pattern |
| 0.5 | Rename SSE/UI: "Platform refresh" + staleness; ban false "vendor live" | Copy review + events.py labels |
| 0.6 | Quarantine/router: advisory labels + confirm dialog + audit event | UI + API audit row |
| 0.7 | ENFORCE_RBAC default on prod profile; extend to incidents/alerts/reports | rbac-audit all green |
| 0.8 | CORS allowlist; rate limit auth + admin | Config documented |
| 0.9 | Regression: auth/RBAC tests + extend pytest | CI gate |

**Blockers for pilot:** 0.1–0.7 minimum.

---

## Phase 1 — UX foundation (P1)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 1.1 | URL routes for shell sections (`/app/telemetry/live`, etc.) | Shareable links work |
| 1.2 | IA restructure per blueprint (merge duplicate Alerts paths) | Nav map signed off |
| 1.3 | Design tokens in CSS + chart/tooltip semantic colors | Dark mode charts readable |
| 1.4 | Global context: site/backend/time range (shell) | Persists in URL |
| 1.5 | Data state banner component (live/sim/stale/unknown) | All data pages use it |
| 1.6 | a11y: focus rings, skip link, dialog focus trap | WCAG-oriented checklist started |
| 1.7 | Deprecate or archive `backend/` duplicate | README points to root `app/` |

---

## Phase 2 — Core observability (P1–P2)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 2.1 | Fleet overview modality-safe aggregates | No raw cross-modality T1 mean in KPIs |
| 2.2 | Metric registry surfaced in explorer UI | Unsupported ≠ zero |
| 2.3 | Table kit: sort/filter/page/virtual scroll where needed | Jobs, backends, alerts |
| 2.4 | Calibration + drift unified time-range control | Same window across tabs |
| 2.5 | OpenAPI-generated TS types or zod from OpenAPI | FE contract checks |

---

## Phase 3 — Reliability operations (P1–P2)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 3.1 | Operations Centre as default for Operator role | Configurable landing |
| 3.2 | Incident lifecycle hardening (RBAC, audit, comments) | E2E workflow test |
| 3.3 | Platform health page (collectors, DB, scheduler, SSE) | Single pane self-obs |
| 3.4 | Event timeline (alerts+incidents+collection failures) | Correlation ID optional |
| 3.5 | Evidence workflow: reviewer role, access control on download | Unauthorized blocked |

---

## Phase 4 — Data platform (P1 prod)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 4.1 | PostgreSQL prod compose + migration runbook | Fresh install on PG |
| 4.2 | Users + audit_log tables; migrate off JSON users | Alembic revision |
| 4.3 | Retention jobs (telemetry tiers, configurable) | Disk growth bounded |
| 4.4 | Backup/restore documented + test | DR drill script |
| 4.5 | Index review for time-series queries | Explain on hot paths |

---

## Phase 5 — Integration maturity (P2)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 5.1 | Provider truth labels in Admin (LIVE/MOCK/STUB) | catalog.py UI |
| 5.2 | IonQ live adapter or explicit MOCK_ONLY gate | Contract test |
| 5.3 | IBM/Rigetti live verification harness (CI optional secrets) | LIVE_IMPLEMENTED_UNVERIFIED → verified |
| 5.4 | Facility MQTT adapter boundary (spec + stub interface) | No fake live readings |
| 5.5 | Circuit breaker + collector failure DLQ table | Self-healing visible in UI |

---

## Phase 6 — Federation and national deploy (P2–P3)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| 6.1 | Site identity + signed snapshots | Import validates signature |
| 6.2 | Air-gap install test from `docker-compose.airgap.yml` | Preflight passes |
| 6.3 | Federation governance doc + trust boundaries | C-DAC sign-off |
| 6.4 | National checklist mapping to phases | Tracker updated |

---

## Parallel workstreams

- **Security** — spans Phase 0–1  
- **Testing** — E2E starts Phase 1; expands each phase (`QTelescope_Testing_and_Acceptance_Checklist.md`)  
- **Docs** — README + operator runbooks after Phase 0  

---

## WORKLOG integration

When starting implementation: set `IN_PROGRESS` to current phase ID (e.g. `IMP-P0`). On phase acceptance, move to `COMPLETE` and advance `NEXT` to following phase.
