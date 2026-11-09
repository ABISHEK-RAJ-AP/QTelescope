# Production readiness — Q-TeleScope

**Verdict: NOT production-ready.** Lab/demo and controlled UAT OK when configured per [`.env.production.example`](../.env.production.example).

**Programme:** [ENTERPRISE_MATURITY_PROGRAM.md](../ENTERPRISE_MATURITY_PROGRAM.md) · **Master checklist:** [MASTER_RELEASE_CHECKLIST.md](MASTER_RELEASE_CHECKLIST.md) (**22/93 PASS**, 2026-11-09)

Unresolved **P1:** QT-06 (bootstrap secrets), QT-07 (MFA at rest), QT-08 (reset email), QT-09 (TeleScope E2E incomplete).

## Counts (numerator / denominator)

| Item | Count | Notes |
| --- | --- | --- |
| Frontend routes inventoried | 28 / 28 | `appNav.js` |
| Frontend `api.js` methods | 143+ | `/api/v1` |
| Backend pytest | **190 passed / 2 skipped** | `USE_ALEMBIC=false`, SQLite, ~5 min (2026-11-09) |
| Auth pytest | 4/4 | `test_auth_mfa_password.py` |
| E2E Playwright TeleScope | **3 smoke / 24 target journeys** | `telescope-smoke.spec.ts` (gated `E2E_PLAYWRIGHT=1`) |
| Responsive viewports | 0 / 9 | NOT_VERIFIED |
| Master checklist | 22 PASS / 93 | See MASTER_RELEASE_CHECKLIST.md |
| P0 open | 0 | |
| P1 open | 4 | QT-06–09 |
| Sprint 1 code | Shipped | Request IDs, command palette, SSE reconnect, design tokens |

## What was executed (2026-11-09)

- Enterprise maturity programme documentation.
- API `X-Request-Id` + structured error envelope.
- Frontend API error parsing + ErrorState reference line.
- Ctrl/Cmd+K command palette (navigation).
- Live telemetry SSE auto-reconnect.
- `tests/test_request_id.py` + Playwright smoke spec.

## What was not executed

- Full browser journey E01–E24.
- Visual regression and 9-viewport responsive pass.
- Load/resilience testing.
- Production Postgres + Redis soak test.
- pip-audit / npm audit this cycle.

## Go-live gate

`ENVIRONMENT=production`, `ENFORCE_RBAC=true`, `REQUIRE_API_AUTH=true`, rotated `SECRET_KEY`, non-default passwords, Postgres `DATABASE_URL`, TLS, explicit `CORS_ORIGINS`, MFA storage hardened, SMTP or approved reset process, `PERSIST_API_SESSIONS`, Playwright green against VM URL, checklist security rows **PASS**.
