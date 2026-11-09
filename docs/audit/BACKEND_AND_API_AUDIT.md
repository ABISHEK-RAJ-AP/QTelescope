# Backend and API audit (Q-TeleScope scope)

**Date:** 2026-11-09  
**Entry:** `app/main.py` · prefix `settings.API_V1_STR` (typically `/api/v1`)

## Router inventory (Telescope core)

| Router module | Domain | Auth pattern (spot check) |
| --- | --- | --- |
| `auth.py` | Login, MFA, sessions | Public + bearer |
| `users.py` | Profile, MFA, sessions | Authenticated |
| `backends.py` | Registry, telemetry, workspace | Authenticated |
| `alerts.py` / `incidents.py` | Alerting, IR | Authenticated + RBAC mutations |
| `operations.py` | Platform health aggregate | Authenticated |
| `admin.py` | Collectors, rules, logs | `require_admin` on sensitive routes |
| `reports.py` / `evidence.py` | Exports, manifests | Authenticated |
| `jobs.py` / `queues.py` | Execution observability | Authenticated |
| `metrics.py`, `drift.py`, `anomalies.py`, `replay.py` | Analytics | Authenticated |

**Out of scope for Telescope UI:** `app/api/development/*`, `app/api/governance/*` (separate products).

## Error envelope

| Layer | Evidence |
| --- | --- |
| Frontend parser | `frontend/src/lib/apiErrors.js` — `error.message`, `error.code`, `request_id` |
| E2E | E22 structured 401 when `REQUIRE_API_AUTH=true` |
| Middleware | Request ID on responses (**grep** `app/core` for full map — Phase 11) |

## Contract highlights

| Endpoint | Notes |
| --- | --- |
| `GET /operations/platform-health` | Aggregates DB, collectors, SLI, synthetics, dependency_links |
| `GET /admin/collector-executions` | `since`/`until`/`status`; 30d client default |
| `GET /admin/app-logs` | Structured app log JSONL |
| `GET /reports/export` | `report_type`, `format=json|html` |

OpenAPI: `/docs` when API running.

## Gaps (P1–P2)

| ID | Item |
| --- | --- |
| B-01 | Full OpenAPI vs frontend `api.js` drift scan |
| B-02 | Pagination consistency (`limit` caps vary by route) |
| B-03 | Idempotency on bulk alert operations |
| B-04 | Rate-limit headers documented for operators |

## Tests

| Suite | Coverage |
| --- | --- |
| `tests/test_collector_executions.py` | JSONL executions |
| `tests/test_incidents_p3.py` | Platform health |
| `tests/test_admin_observability_api.py` | Admin logs |
| Auth/RBAC | Partial — see SECURITY_REVIEW |
