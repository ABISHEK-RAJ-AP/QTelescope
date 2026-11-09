# Enterprise implementation backlog (post–Gate 0)

**Source:** [ENTERPRISE_BASELINE_RECONCILIATION.md](ENTERPRISE_BASELINE_RECONCILIATION.md)  
**Ordering:** Dependency-aware; **P0** reconciliation done in Gate 0.

Priority: **P0** gate · **P1** Release B/C core · **P2** Release D · **P3** Release E / polish

## Legend

| Tag | Meaning |
| --- | --- |
| ✅ SHIPPED | v1 in repo — extend only, do not replace |
| 🔧 EXTEND | Partial — close acceptance gaps |
| ⬜ OPEN | Not started |
| 🔒 BLOCKED | Needs credentials / VM / prod env |

---

## P0 — Reconciliation & evidence (Gate 0)

| ID | Work | Status | Evidence / next |
| --- | --- | --- | --- |
| G0.1 | Baseline reconciliation doc | ✅ SHIPPED | This wave |
| G0.2 | Checklist count accuracy | ✅ SHIPPED | 19/93 PASS |
| G0.3 | Re-run Playwright + refresh E2E doc | ✅ SHIPPED | 27 pass / 3 skip / 0 fail — 2026-11-09 |
| G0.4 | QT-06 demo secret rotation on internet hosts | 🔒 BLOCKED | Ops |

---

## Release B — Prompt 1 (B-S4 pipelines, logs, search)

| ID | Acceptance | Status | Files / gap |
| --- | --- | --- | --- |
| B-S4.1 | B07 collector history | ✅ SHIPPED | JSONL; extend for B2 |
| B-S4.2 | B2 executions 30d + filters | 🔧 EXTEND | `since`/`until`/`status` API + 30d default in UI; JSONL retention days + size cap |
| B-S4.3 | B3 ingestion quality schema | 🔧 EXTEND | v2 schema; `rejected_records`/`duplicate_records` still null |
| B-S4.4 | B1 unified Logs Explorer | 🔧 EXTEND | Audit + application tabs; not full stdout index |
| B-S4.5 | Alert → log navigation | 🔧 EXTEND | `buildLogsExplorerLocation` + Alert detail **Related logs** |
| B-S4.6 | Entity search (palette) | 🔧 EXTEND | +jobs, collectors; F11 |
| B-S4.7 | Quality on Platform Health / backend | 🔧 EXTEND | Platform Health table + backend workspace ingestion chip |

---

## Release B — Prompt 2 (B-S5 metrics, catalogue, tables)

| ID | Acceptance | Status | Files / gap |
| --- | --- | --- | --- |
| B-S5.1 | B4 saved metric queries | 🔧 EXTEND | localStorage only |
| B-S5.2 | B5 owner/facility | 🔧 EXTEND | `backend_catalog.json` v1 |
| B-S5.3 | Dependency map | 🔧 EXTEND | `dependency_links` on platform-health |
| B-S5.4 | EnterpriseDataTable rollout | 🔧 EXTEND | Platform Health, Calibration, Jobs table layout — [SPRINT2_ROUTE_AUDIT.md](SPRINT2_ROUTE_AUDIT.md) |
| B-S5.5 | Metric registry-driven explorer | 🔧 EXTEND | 3 hardcoded series |

---

## Release B — Prompt 3 (B-S6 SLO, OTel, synthetics, visual)

| ID | Acceptance | Status |
| --- | --- | --- |
| B-S6.1 | B6 SLI hourly | 🔧 PARTIAL — collector success SLI from `collector_executions.jsonl`; hourly JSONL snapshot; Platform Health `slis[]` |
| B-S6.2 | B7 trace waterfall | ⬜ OPEN |
| B-S6.3 | B8 synthetic probe | 🔧 PARTIAL — DB `SELECT 1` on platform-health `synthetics[]` |
| B-S6.4 | B9 screenshots T05/T06 | ⬜ OPEN |

---

## Release C — Prompts 4–6 (S7–S9)

| Theme | Status | Notes |
| --- | --- | --- |
| Composite alerts C1 | ⬜ OPEN | Q09 FAIL |
| Notification centre C2 | ⬜ OPEN | SMTP reset only |
| On-call / escalation C3 | ⬜ OPEN | |
| Incident workspace C4–C5 | 🔧 EXTEND | Incidents exist; links weak |
| Change / maintenance / policy | ⬜ OPEN | |
| Backup restore C7 | 🔒 BLOCKED | D06 NOT_VERIFIED |

---

## Release D — Prompts 7–8 (S10–S11)

| Theme | Status |
| --- | --- |
| Calibration revision A/B D1 | 🔧 EXTEND |
| Gate-level metrics D2 | 🔧 EXTEND |
| Readiness scorecard D3 | ⬜ OPEN |
| Benchmark runs D4 | ⬜ OPEN |
| Workload–calibration D5 Q13 | ⬜ OPEN FAIL |

---

## Release E — Prompt 9 (S12–S14)

| Theme | Status |
| --- | --- |
| Facility-scoped auth E1 | ⬜ OPEN |
| API keys / webhooks E2 | ⬜ OPEN |
| Workbooks E3 | ⬜ OPEN |
| UAT E4 | ⬜ OPEN |

---

## Cross-cutting — Prompts 10–12

| Theme | Status |
| --- | --- |
| UX / terminology / a11y (Prompt 10) | 🔧 EXTEND |
| API consistency, retention, outbox (Prompt 11) | 🔧 EXTEND |
| Final QA + north-star E2E (Prompt 12) | ⬜ OPEN |
| **E25** backend→evidence journey | ⬜ OPEN (user-requested) |
| **E26–E29** resilience/governance journeys | ⬜ OPEN |

---

## Recommended next 3 sprints (engineering)

1. **B-S4 finish:** structured app logs + log UI; extend execution/quality schema; alert→log; entity search jobs/collectors; integrate quality tiles.
2. **B-S5 finish:** server saved queries; dependency map v1; table rollout wave 1 (alerts, jobs, incidents).
3. **B-S6 start:** one SLI + synthetic probe + screenshot CI baseline.

Do **not** start benchmarking centre or facility SaaS tenancy before B-S4 data-quality truth is end-to-end (principles 1–4).
