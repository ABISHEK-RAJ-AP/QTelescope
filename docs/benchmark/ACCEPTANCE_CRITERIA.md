# Acceptance criteria — benchmark releases

**Date:** 2026-11-09 · Gate docs: [MASTER_RELEASE_CHECKLIST](../QA/MASTER_RELEASE_CHECKLIST.md)

## Global gates (every release)

- No new **FAIL** on security rows S01–S06, S04 MFA, S08 headers.  
- Pytest green on touched modules; Playwright smoke not regressed.  
- Provenance: stale/partial data visibly labelled (principle 1).  
- Each feature: at least one automated check (pytest, Playwright, or Vitest).

---

## Release A — Foundation ✅

| Criterion | Measure |
| --- | --- |
| A1 | `MASTER_RELEASE_CHECKLIST` ≥ 33 PASS with cited evidence |
| A2 | `scripts/run-e2e-telescope.sh` ≥ 22 pass, 0 fail serial |
| A3 | `.env.production.example` documents SMTP, MFA, auth flags |
| A4 | Sprint docs S1–S3 + benchmark INDEX published |

---

## Release B — Enterprise observability

| ID | Criterion | Verification | Status (2026-11-09) |
| --- | --- | --- | --- |
| B1 | Logs Explorer: search by `request_id`, backend, time | Playwright + manual | **PARTIAL** — audit + app JSONL; collector emits logs |
| B2 | Collector executions queryable 30d | API test + Platform Health UI | **PARTIAL** — since/until filters; file retention not 30d SLA |
| B3 | Data quality report after collection | pytest fixture ingest | **PARTIAL** — schema v2 + measured telemetry rows; `test_ingestion_quality_v2` |
| B4 | Metrics Explorer saves/restores one query | E2E journey | **PARTIAL** — localStorage; E26 spec |
| B5 | Resource row shows owner + facility fields | API + inventory UI | **PARTIAL** — v1 catalogue; pytest |
| B6 | SLO: 1 SLI measured hourly | Job log + dashboard tile | **OPEN** |
| B7 | Trace waterfall for one API request | Trace ID in UI or Jaeger link | **OPEN** |
| B8 | Synthetic probe fires alert on forced failure | Integration test | **OPEN** |
| B9 | T05/T06: baseline screenshots stored | CI artefact | **OPEN** |

Gate 0: [../QA/ENTERPRISE_BASELINE_RECONCILIATION.md](../QA/ENTERPRISE_BASELINE_RECONCILIATION.md)

---

## Release C — Enterprise operations

| ID | Criterion | Verification |
| --- | --- | --- |
| C1 | Composite rule creates single incident from 3 alerts | pytest + E2E |
| C2 | Notification delivers to configured channel | SMTP/webhook test |
| C3 | On-call schedule routes after SLA breach | unit test |
| C4 | Postmortem PDF/markdown export from incident | manual |
| C5 | Change record for threshold edit | audit diff |
| C6 | Maintenance window suppresses alert | time-boxed test |
| C7 | Backup restore drill documented | QA report |

---

## Release D — Quantum intelligence

| ID | Criterion | Verification |
| --- | --- | --- |
| D1 | Calibration revision A vs B diff | UI test |
| D2 | Gate metric when provider supplies data | sample IBM backend |
| D3 | Readiness scorecard ≥8 criteria | static checklist |
| D4 | Benchmark run stored + listed | DB row + UI |
| D5 | Replay links job to calibration revision | integration test |
| D6 | Stale metric never renders as 0% error | UI assertion |

---

## Release E — Advanced enterprise

| ID | Criterion | Verification |
| --- | --- | --- |
| E1 | Facility-scoped user sees only facility backends | RBAC test |
| E2 | API key + webhook with delivery log | developer UI |
| E3 | Workbook template “Daily fleet review” | save/load |
| E4 | UAT sign-off record in docs/QA | stakeholder form |

---

## Operator north-star (Release C+)

From one **backend** detail view, an operator can:

1. See health, freshness, and data quality separately.  
2. Open correlated alerts/incidents.  
3. Jump to telemetry + calibration for the incident window.  
4. Assign owner and track resolution.  
5. Export evidence with hash verification.

Playwright journey **E25+** (future) should encode this spine.
