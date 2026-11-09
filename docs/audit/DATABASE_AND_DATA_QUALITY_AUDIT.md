# Database & query audit (initial)

**Date:** 2026-11-09  
**Scope:** TeleScope SQLAlchemy models + hot API paths

## Indexes (Alembic)

| Index | Table | Columns | Rationale |
| --- | --- | --- | --- |
| `ix_alerts_status_severity` | alerts | status, severity | Filter chips / summary |
| `ix_alerts_status_detected` | alerts | status, detected_at | Active list sort (**0016**) |
| `ix_alerts_detected_at` | alerts | detected_at | Timeline / recent-first |
| `ix_qubit_telemetry_backend_ts` | qubit_telemetry | backend_id, timestamp | Qubit history |
| `ix_backend_telemetry_backend_ts` | backend_telemetry | backend_id, timestamp | Live/historical |

## Fixes applied 2026-11-09

| Area | Change |
| --- | --- |
| Admin dashboard summary | `sum(qubit_count)` via SQL `func.sum` — no full backend row load |
| Alerts summary | Severity counts via `COUNT`; backend rollups stream `yield_per(512)` |
| Slow requests | `SlowRequestMiddleware` + `Server-Timing` header |

## Open

- Postgres-only partial indexes when `DATABASE_URL` is not SQLite.
- Broader telemetry join batching on `GET /health/backends` (per-backend qubit loop).

## Closed (2026-11-09 follow-up)

- `GET /alerts?offset=` + UI load-more.
- Incident list N+1 (batched alert counts).
