# Security review (initial)

**Date:** 2026-11-09  
**Standard:** OWASP ASVS-oriented checklist — **not** a certification claim.

## Verdict

**LAB BASELINE** — auth enforced in E2E API mode; production internet **NOT READY** (see PRODUCTION_READINESS.md, checklist S02/D05).

## Controls verified (evidence)

| Control | Evidence |
| --- | --- |
| API auth gate | E22 — 401 + `request_id` when `REQUIRE_API_AUTH=true` |
| Admin routes | `require_admin` on collector/logs/rule mutations (`app/api/admin.py`) |
| CAPTCHA (lab) | E01–E05; `E2E_CAPTCHA_BYPASS` for automation only |
| Session logout | E20 sign-in gate after logout |
| Frontend error hygiene | No stack traces in `apiErrors.js` user strings |
| CSV export injection | `frontend/src/lib/csvExport.js` + Vitest |

## Open / needs deeper pass

| Sev | Topic | Notes |
| --- | --- | --- |
| P1 | Secrets on disk | `scripts/scan-default-secrets.sh` for lab defaults in tracked files |
| P1 | `REQUIRE_API_AUTH=false` misconfig | **DONE** — `validate_startup_configuration()` logs errors in prod profile |
| P2 | E21 multi-session revoke | Needs `PERSIST_API_SESSIONS=true` + 2 sessions |
| P2 | CORS / CSP headers | Not audited this pass |
| P2 | Dependency CVEs | `pip-audit`, `npm audit` not run this pass |
| P2 | Export RBAC | Reports endpoints — verify role matrix in pytest |

## Operator guidance

- Rotate demo secrets (checklist **S02**) before internet exposure.
- Do not enable `E2E_CAPTCHA_BYPASS` outside test harness.
- Govern/QRP namespaces excluded from this review.

## Cloudflare security-audit-skill (run-1)

Full-audit output: [`../../security-audit/run-1/REPORT.md`](../../security-audit/run-1/REPORT.md) + `findings.json`. Skill copy: `.cursor/skills/security-audit/` (upstream: `cloudflare/security-audit-skill`).

## Remediation log

| ID | Action | Status |
| --- | --- | --- |
| SEC-01 | CSV formula prefix guard | **Done** 2026-11-09 |
| SEC-02 | Full ASVS L2 walk | Planned |
| SEC-03 | Admin router default `require_admin` | **Done** 2026-11-09 |
| SEC-04 | Block `X-User-Role` spoof when `ENFORCE_RBAC` | **Done** 2026-11-09 |
| SEC-05 | SSE query token → stream ticket | **Done** 2026-11-09 |
