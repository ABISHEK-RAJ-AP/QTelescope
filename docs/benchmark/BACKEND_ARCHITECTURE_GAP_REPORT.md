# Backend architecture gap report

**Date:** 2026-11-09 · Scope: `app/`

## Current architecture (as implemented)

```
Providers (IBM, IonQ, Rigetti, on-prem, STUB slots)
    → collectors / scheduler (`workers/collection_scheduler.py`)
    → normalizers (`normalizers/`, `app/metrics/`)
    → SQLAlchemy models (`app/models/entities.py`)
    → health + alert engines (`monitoring/`, `alerts/`)
    → FastAPI routers (`app/api/*`)
    → SSE (`app/api/events.py`)
    → React (`frontend/src/services/api.js`)
```

## Strengths

- **Structured errors** + `X-Request-Id` (`request_id.py`, middleware).
- **Optional API auth** with prod defaults (`api_auth.py`, `sessions.py`).
- **RBAC** dependency injection (`rbac.py`, tests in `tests/test_rbac.py`).
- **Rate limiting** (`rate_limit.py`).
- **Hardware discovery** on startup (`discovery/hardware_discovery.py`).
- **Evidence builder** (`evidence/snapshot_builder.py`).
- **Federated / operations** endpoints for centre views.

## Gaps vs mature platforms

| Capability | Status | Files / notes |
| --- | --- | --- |
| Consistent error envelope on all paths | PARTIAL | Some routers raise raw HTTPException |
| Pagination standards | PARTIAL | Inconsistent `limit`/`offset` |
| Collector execution history API | PARTIAL | Admin collectors; B07 FAIL checklist |
| DLQ inspection | PARTIAL | No operator-facing DLQ browser |
| Retry / timeout policy centralization | FAIL | Per-adapter variance |
| Circuit breakers | UNIMPLEMENTED | No `circuit_breaker` module |
| Transactional outbox | UNIMPLEMENTED | SSE not durable-replay |
| OpenTelemetry traces | UNIMPLEMENTED | Only request IDs |
| Structured JSON logging schema | PARTIAL | Mixed log styles |
| Synthetic probe runner | UNIMPLEMENTED | External Playwright only |
| Composite alert evaluator | UNIMPLEMENTED | `alert_engine.py` |
| SLO measurement jobs | UNIMPLEMENTED | — |
| Webhook delivery | UNIMPLEMENTED | — |
| Pipeline version registry | UNIMPLEMENTED | — |
| Data quality report API | UNIMPLEMENTED | Extend provenance |

## Recommended architecture increments (P1)

1. **`ingestion_quality`** service — counts expected/valid/rejected per collection (Splunk-style report).  
2. **`collector_runs`** table — persist each scheduler execution (feeds Platform Health + B07).  
3. **`alert_correlation_rules`** — AWS composite boolean layer above existing alerts.  
4. **Provider circuit wrapper** — shared decorator on adapter HTTP calls.  
5. **OTel** — FastAPI + httpx instrumentation first; collector span second.

## Non-goals (this phase)

- Kafka/Kinesis unless measured throughput requires it.  
- Full multi-tenant SaaS — prefer **facility scoping** first.
