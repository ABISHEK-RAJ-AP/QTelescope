# Production readiness — Q-TeleScope

**Verdict: NOT production-ready.** Lab/demo usable. Unresolved P1: default bootstrap secrets in local `.env`, MFA secrets at rest, no reset email, no TeleScope browser E2E.

## Counts (numerator / denominator)

| Item | Count | Notes |
| --- | --- | --- |
| Frontend routes inventoried | 28 / 28 | Public 5 + `/app/*` map in `appNav.js` |
| Interactive elements | ~243 button hits grepped; not every click exercised in browser | Classify in interaction matrix |
| Frontend `api.js` methods | 143+ | Mapped to `/api/v1` |
| Backend pytest | 167 passed / 171 collected (e2e ignored); 2 Govern tests skipped | 12 min run |
| Auth pytest | 4/4 in `test_auth_mfa_password.py` | MFA, reset, change password |
| E2E Playwright TeleScope | 0 / 12 listed journeys | BLOCKED — no `E2E_PLAYWRIGHT`, no TeleScope spec |
| Responsive viewports | 0 / 9 | BLOCKED — no browser session this cycle |
| P0 open | 0 | |
| P1 open | 3 | QT-06, QT-07, QT-08 |
| P2 open | 4 | QT-05, QT-09, QT-10, QT-11 |
| Defects fixed this cycle | 4 | QT-01–04 |

## What was executed

- Repository inventory (`docs/QA/APP_INVENTORY.md`).
- Pytest on SQLite memory (no live Postgres/Redis).
- Auth/RBAC/session/security-header tests.
- Code fix: operations health/centre survive missing tables.

## What was not executed (BLOCKED)

- Live IBM/IonQ/Rigetti adapters (no tokens in this environment).
- Browser click-through of every page.
- Playwright login → MFA → dashboard.
- Responsive 1920–360 screenshots.
- Dependency CVE scan (`pip-audit` / `npm audit` not run this cycle).

## Go-live gate

Set `ENVIRONMENT=production`, `ENFORCE_RBAC=true`, `REQUIRE_API_AUTH=true`, rotate `SECRET_KEY`, non-default passwords, Postgres `DATABASE_URL`, TLS, CORS origins, encrypt MFA store or use DB, SMTP or out-of-band reset, persist sessions, run Playwright against the VM URL.
