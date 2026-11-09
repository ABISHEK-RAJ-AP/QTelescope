# Enterprise baseline reconciliation (Gate 0)

**Authority:** This document is the **single reconciled baseline** when programme docs, benchmark reports, or chat summaries disagree.  
**Evidence date:** 2026-11-09  
**Git branch:** `main` (commits through `120b98f` — local, **not pushed** to `origin` at reconciliation time)  
**Scope:** `frontend/`, `app/`, `tests/` (excludes Govern, QRP, qniverse)

## 1. Executive verdict

| Question | Answer |
| --- | --- |
| Production-ready for public internet? | **NO** — [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md); open **FAIL** rows (S02, D05, D09, D10, Q09, Q13, T13, B05, …) |
| Release A (foundation) lab baseline? | **YES (lab)** — Sprints S1–S3 evidence + security pytest |
| Release B observability? | **PARTIAL** — S4/S5 slices shipped; acceptance B1–B3, B6–B9 **open** |
| Readiness scorecard ~1.9/4? | **Maturity index, not % complete** — do not equate to “48% production ready” |

## 2. Documentation conflicts resolved

### 2.1 Collector execution history & ingestion quality vs B07

| Source | Claim | **Reconciled truth** |
| --- | --- | --- |
| `benchmark/FEATURE_GAP_MATRIX.md` (Telemetry pipeline) | PARTIAL — “Pipeline run history UI” | **PARTIAL** — v1 **shipped**: JSONL + admin UI + APIs; **not** enterprise-grade (no DB, no 30d API contract, no trigger/retry/record counts) |
| `SPRINT4_OBSERVABILITY.md` | Shipped; B07 PASS | **Correct for checklist B07** — “history + quality UI + APIs” per row definition |
| `IMPLEMENTATION_ROADMAP.md` S4 bullets | Lists collector history as future | **Superseded** — see [benchmark/IMPLEMENTATION_ROADMAP.md](../benchmark/IMPLEMENTATION_ROADMAP.md) § “Shipped on main” |
| Master checklist B07 | PASS | **PASS** — `tests/test_collector_executions.py`, Admin Collectors tables |

**Do not rebuild** JSONL execution/quality wiring. **Do** extend for B2/B3: retention, richer schema, Platform Health integration, per-record quality (Prompt 1.2–1.3).

### 2.2 Master checklist totals (33/93 vs 34/93)

| Source | Claim | **Reconciled truth** |
| --- | --- | --- |
| Programme / checklist header | 34 PASS | **Wrong** — recount 2026-11-09 |
| Earlier programme | 33 PASS | **Stale** (pre-B07 PASS) |

**Authoritative checklist summary (93 rows):**

| Status | Count |
| --- | ---: |
| PASS | **19** |
| PARTIAL | **47** |
| FAIL | **8** |
| NOT_VERIFIED | **19** |

Per-section PASS counts are corrected in [MASTER_RELEASE_CHECKLIST.md](MASTER_RELEASE_CHECKLIST.md) headers.

### 2.3 Playwright evidence (22–24 pass, 2–6 skip)

| Source | Claim | **Reconciled truth** |
| --- | --- | --- |
| `E2E_TELESCOPE_EVIDENCE.md` | 22–24 pass, 2–6 skip | **Normalize:** catalogue **30** `telescope` tests (E01–E26; E22 appears in multiple files) |
| Sprint 3 gate | 22 pass, 6 skip, 0 fail | **Last documented full serial run** before E25/E26 added |
| Current repo | E25 audit, E26 metrics explorer | **Re-run required** to refresh evidence |

**Canonical lab gate (until re-run):** `≥22 passed`, `≤6 skipped`, `0 failed`, `PW_WORKERS=1`, `scripts/run-e2e-telescope.sh`.

### 2.4 Sprint numbering overlap (S1–S6 vs S4–S14)

| Namespace | Meaning |
| --- | --- |
| **Phase sprints S1–S6** | Original [ENTERPRISE_MATURITY_PROGRAM.md](../ENTERPRISE_MATURITY_PROGRAM.md) 12-week plan (foundation → validation) |
| **Benchmark sprints S4–S14** | Release B–E execution waves mapped to [IMPLEMENTATION_ROADMAP.md](../benchmark/IMPLEMENTATION_ROADMAP.md) |

**Rule:** In engineering docs, prefix benchmark work as **“B-S4”** (Release B, sprint S4) when ambiguity matters. Phase **S4** (operator workflows) ≠ benchmark **S4** (pipelines & logs) — same label, different axes; backlog uses **Release + Prompt ID**.

### 2.5 Feature gap matrix vs code (circuit breaker)

| Matrix row | Was | **Truth** |
| --- | --- | --- |
| Circuit breaker | UNIMPLEMENTED | **PARTIAL** — `app/services/circuit_breaker.py`, discovery + `operations/platform-health` snapshot |

## 3. Verified implementation (Release B slices on `main`)

| Capability | Classification | Evidence |
| --- | --- | --- |
| Collector execution history | PARTIAL | `app/services/collector_executions.py`, `GET /admin/collector-executions`, Admin Collectors UI, B07 PASS |
| Ingestion quality snapshots | PARTIAL | `app/services/ingestion_quality.py`, heuristic completeness only |
| Audit log search (not unified logs) | PARTIAL | `app/core/audit_log.py`, `/app/admin/logs`, E25 |
| Command palette entity search | PARTIAL | `CommandPalette.jsx` backends/alerts/incidents (≥2 chars); not jobs/collectors/reports |
| Metrics Explorer v1 | PARTIAL | `/app/telemetry/explorer`, localStorage saves, Vitest, E26 |
| Resource catalogue v1 | PARTIAL | `backend_catalog.json`, inventory owner/facility/tags, B5 lab |
| Platform Health → collectors | PARTIAL | Collectors tile deep link |

**Not shipped (do not claim):** unified app log index, 30d execution query API, alert→log links, server-backed saved metric queries, dependency map, SLO/OTel/synthetics, composite alerts.

## 4. Test evidence snapshot

| Suite | Status | Notes |
| --- | --- | --- |
| `pytest` (full) | Referenced T02 | Re-run before release gate; module tests for S4/S5 added |
| `npm test` (Vitest) | PASS infra | + `metricsExplorerQueries.test.js` |
| Playwright telescope | NEEDS_VERIFICATION | E25/E26 not in Sprint 3 evidence row |

## 5. Superseded documentation

| Document | Action |
| --- | --- |
| Checklist summary 34/93 | **Updated** → 19/93 |
| Programme “33/93 PASS” in Release A line | **Updated** → 19/93 + note |
| Roadmap S4 bullets (unshipped) | **Annotated** shipped vs remaining |
| E2E “22–24” range | **Tightened** to gate + re-run note |

## 6. Programme execution rule (from user prompt)

1. **Gate 0** — this file + [ENTERPRISE_IMPLEMENTATION_BACKLOG.md](ENTERPRISE_IMPLEMENTATION_BACKLOG.md) + [ENTERPRISE_DEPENDENCY_GRAPH.md](ENTERPRISE_DEPENDENCY_GRAPH.md) + [ENTERPRISE_SPRINT_IMPLEMENTATION_CHECKLIST.md](ENTERPRISE_SPRINT_IMPLEMENTATION_CHECKLIST.md).
2. **No duplicate builds** of shipped v1 collector/audit/catalogue/metrics explorer.
3. **Next engineering:** Release B **outstanding** (Prompt 1 remainder → Prompt 3), then C→E per backlog.
4. **North-star:** interconnect workflows (backend → alert → log → incident → evidence) before new orphan pages.

## 7. Related artefacts

- [ENTERPRISE_IMPLEMENTATION_BACKLOG.md](ENTERPRISE_IMPLEMENTATION_BACKLOG.md)
- [ENTERPRISE_DEPENDENCY_GRAPH.md](ENTERPRISE_DEPENDENCY_GRAPH.md)
- [ENTERPRISE_SPRINT_IMPLEMENTATION_CHECKLIST.md](ENTERPRISE_SPRINT_IMPLEMENTATION_CHECKLIST.md)
- [../benchmark/INDEX.md](../benchmark/INDEX.md)
