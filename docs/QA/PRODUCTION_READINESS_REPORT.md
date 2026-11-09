# Production readiness — Q-TeleScope

**Verdict: NOT production-ready.** Lab/demo and controlled UAT OK when configured per [`.env.production.example`](../.env.production.example).

**Programme:** [ENTERPRISE_MATURITY_PROGRAM.md](../ENTERPRISE_MATURITY_PROGRAM.md) · **Benchmark / gap:** [../benchmark/INDEX.md](../benchmark/INDEX.md) · **Master checklist:** [MASTER_RELEASE_CHECKLIST.md](MASTER_RELEASE_CHECKLIST.md) (**33/93 PASS**, 2026-11-09)

Unresolved **P1:** QT-06 (demo secrets / rotation on internet-facing hosts). **QT-07–09** closed in lab; **QT-08** needs real SMTP on VM; **QT-09** re-run on deployment URL before go-live.

## Counts (numerator / denominator)

| Item | Count | Notes |
| --- | --- | --- |
| Frontend routes inventoried | 28 / 28 | `appNav.js` |
| Frontend `api.js` methods | 143+ | `/api/v1` |
| Backend pytest | **190 passed / 2 skipped** | `USE_ALEMBIC=false`, SQLite, ~5 min (2026-11-09) |
| Auth pytest | 4/4 | `test_auth_mfa_password.py` |
| E2E Playwright TeleScope | **22 pass / 6 skip** (2026-11-09 lab) | [E2E_TELESCOPE_EVIDENCE.md](E2E_TELESCOPE_EVIDENCE.md); re-run on VM |
| Frontend Vitest | **7 tests** | `cd frontend && npm test` |
| Responsive viewports | 0 / 9 | NOT_VERIFIED |
| Master checklist | 33 PASS / 93 | 26 PARTIAL = S4–S6 backlog |
| P0 open | 0 | |
| P1 open | 1 | QT-06 (env rotation) |
| Sprint 1–3 code | In progress | S3 wave 1: MFA encrypt, prod bootstrap default |

## What was executed (2026-11-09)

- Enterprise maturity programme documentation.
- API `X-Request-Id` + structured error envelope.
- Frontend API error parsing + ErrorState reference line.
- Ctrl/Cmd+K command palette (navigation).
- Live telemetry SSE auto-reconnect.
- `tests/test_request_id.py` + Playwright smoke spec.
- Sprint 3: MFA `secret_enc`, prod bootstrap default, SMTP password-reset path.

## What was not executed

- Full browser journey E07–E24.
- Visual regression and 9-viewport responsive pass.
- Load/resilience testing.
- Production Postgres + Redis soak test.
- pip-audit / npm audit this cycle.

## Go-live gate

`ENVIRONMENT=production`, `ENFORCE_RBAC=true`, `REQUIRE_API_AUTH=true`, rotated `SECRET_KEY`, non-default passwords, Postgres `DATABASE_URL`, TLS, explicit `CORS_ORIGINS`, MFA storage hardened, SMTP or approved reset process, `PERSIST_API_SESSIONS`, Playwright green against VM URL, checklist security rows **PASS**.
