# Sprint 4 — observability slice (Release B start)

**Evidence date:** 2026-11-09  
**Scope:** Collector run history, ingestion quality snapshots, operator audit log explorer (audit JSONL only — not full structured app log index).

## Shipped

| Area | Implementation | Verification |
| --- | --- | --- |
| Execution history | `app/services/collector_executions.py` JSONL; wired from `record_provider_run()` | `pytest tests/test_collector_executions.py` |
| Ingestion quality | `app/services/ingestion_quality.py` JSONL | same pytest + `GET /admin/ingestion-quality` |
| Admin APIs | `GET /admin/collector-executions`, `/ingestion-quality`, `/audit-log` | `pytest tests/test_audit_log_search.py` |
| UI — Collectors | Run history + quality tables on Admin → Collectors | Manual: `/app/admin/collectors` |
| UI — Audit log | Admin → Audit log (`/app/admin/logs`) search by text, action, actor | Manual + RBAC via `visibleAdminNav` |

## Also shipped (S4 continuation)

| Item | Evidence |
| --- | --- |
| Observability admin APIs gated | `require_admin` on executions / quality / audit; `test_admin_observability_api.py` |
| Platform Health → collectors | Collectors tile links to run history |
| Command palette entity search | Backends, active alerts, open incidents (≥2 chars) |
| Playwright E25 | `telescope-journeys-admin.spec.ts` audit log |

## Not in this slice

- Unified index of application stdout / correlation across services (AC B1 full Splunk-class explorer)
- Dedicated `request_id` filter (use audit text search)

## Checklist impact

| ID | Before | After | Notes |
| --- | --- | --- | --- |
| B07 | FAIL | **PASS** | History + quality UI + APIs |
| D12 | PARTIAL | PARTIAL | Search UI on immutable JSONL; no WORM store |
| Benchmark Logs explorer row | UNIMPLEMENTED | **PARTIAL** | Audit JSONL explorer only |

## Run tests

```bash
PYTHONPATH=. pytest tests/test_collector_executions.py tests/test_audit_log_search.py -q
```
