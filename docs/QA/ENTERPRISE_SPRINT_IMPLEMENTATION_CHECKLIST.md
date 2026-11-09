# Enterprise sprint implementation checklist (Prompts 0–12)

**Baseline:** [ENTERPRISE_BASELINE_RECONCILIATION.md](ENTERPRISE_BASELINE_RECONCILIATION.md)  
**Use:** Tick only with file path + test/evidence. Do not mark ✅ if UI-only or doc-only.

## Naming

| Label | Meaning |
| --- | --- |
| **Phase S1–S6** | Original maturity programme weeks |
| **B-S4** | Release B benchmark sprint 4 (Prompt 1) |
| **Prompt N** | User programme prompt block |

---

## Gate 0 — Prompt 0 ✅ (documentation)

- [x] Reconcile collector/B07 vs matrix
- [x] Reconcile checklist counts (19 PASS / 93)
- [x] Reconcile Playwright evidence language
- [x] Sprint numbering note (Phase vs benchmark)
- [x] `ENTERPRISE_BASELINE_RECONCILIATION.md`
- [x] `ENTERPRISE_IMPLEMENTATION_BACKLOG.md`
- [x] `ENTERPRISE_DEPENDENCY_GRAPH.md`
- [ ] Full capability inventory CSV (93+ matrix rows) — **ongoing in backlog rows**
- [ ] Re-run Playwright for E25/E26 evidence

---

## B-S4 — Prompt 1 (pipelines, logs, collectors)

| # | Requirement | Status | Evidence / gap |
| --- | --- | --- | --- |
| 1.1 | Verify execution history — no rebuild | ✅ | `collector_executions.py`, B07 |
| 1.2 | Durable execution record (full schema) | 🔧 | `trigger_type`, `since`/`until` filters; no retry/record counts |
| 1.3 | Ingestion quality v2 | 🔧 | schema v2, cycle stats, Platform Health table |
| 1.4 | Unified Logs Explorer | 🔧 | `0cb168f` audit + app tabs; `app_structured.jsonl` |
| 1.5 | Alert → log links | 🔧 | `buildLogsExplorerLocation`, alert **Related logs** |
| 1.6 | Entity search palette | 🔧 | + jobs, collectors (`CommandPalette.jsx`) |
| 1.7 | Tests B1–B3 | 🔧 | `test_app_structured_log.py` + collector tests |

---

## B-S5 — Prompt 2 (metrics, catalogue, tables)

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.1 | Metrics Explorer operational | 🔧 | `MetricsExplorer.jsx` |
| 2.2 | Durable saved queries | 🔧 | localStorage |
| 2.3 | Resource catalogue | 🔧 | `backend_catalog.py` |
| 2.4 | Dependency map | ⬜ | |
| 2.5 | EnterpriseDataTable rollout | 🔧 | Platform Health only + audit |

---

## B-S6 — Prompt 3 (SLO, OTel, synthetics, visual)

| # | Requirement | Status |
| --- | --- | --- |
| 3.1–3.6 | B6–B9 | ⬜ |

---

## Release C — Prompts 4–6 (S7–S9)

| Prompt | Theme | Status |
| --- | --- | --- |
| 4 | Composite alerts, notifications | ⬜ |
| 5 | On-call, incident workspace, handover | 🔧 partial incidents |
| 6 | Change, maintenance, policy, backup | ⬜ |

---

## Release D — Prompts 7–8 (S10–S11)

| Prompt | Theme | Status |
| --- | --- | --- |
| 7 | Calibration intelligence | 🔧 |
| 8 | Benchmarking, readiness, reconstruction | ⬜ Q13 FAIL |

---

## Release E — Prompt 9 (S12–S14)

| Prompt | Theme | Status |
| --- | --- | --- |
| 9 | Facility scope, API keys, dev centre, UAT | ⬜ |

---

## Cross-cutting — Prompts 10–12

| Prompt | Theme | Status |
| --- | --- | --- |
| 10 | UX / slop / a11y | 🔧 |
| 11 | API/DB/security hardening | 🔧 |
| 12 | Final gate + north-star journey | ⬜ |

---

## Extended E2E catalogue (user additions)

| ID | Journey | Status |
| --- | --- | --- |
| E01–E24 | Core | ✅ documented gate |
| E25 | Audit log | 🔧 spec added; re-run |
| E26 | Metrics save/restore | 🔧 spec added; re-run |
| E27 | Backend→evidence (full) | ⬜ proposed north-star |
| E28 | Collector failure recovery | ⬜ |
| E29 | Facility auth | ⬜ |
| E30 | Change/maintenance governance | ⬜ |

---

## Master checklist FAIL rows (must clear for production)

| ID | Item | Sprint owner |
| --- | --- | --- |
| B05 | Timeout/retry policies | Prompt 11 |
| D05 | Retention/archival | Prompt 11 |
| D09 | Quality state E2E | B-S4 / Prompt 1 |
| D10 | Stale/partial states | B-S4 |
| S02 | Secrets rotated | G0.4 ops |
| Q09 | Alert correlation | Prompt 4 |
| Q13 | Workload–calibration | Prompt 8 |
| T13 | OTel/Prometheus | Prompt 3 |

---

## After each implementation unit

1. Inspect existing code  
2. Smallest complete diff  
3. Pytest / Vitest / Playwright as applicable  
4. Update row in this file + `MASTER_RELEASE_CHECKLIST.md` + `FEATURE_GAP_MATRIX.md`  
5. No PASS without reproducible command  
