# API test matrix (Q-TeleScope critical paths)

Auth on when `REQUIRE_API_AUTH` (prod default). Lab often off.

| Method | Path | Purpose | Auth | Tests | Result 2026-11-05 |
| --- | --- | --- | --- | --- | --- |
| GET | `/healthz` | Liveness | Public | startup client | not isolated this run |
| GET | `/api/v1/auth/captcha` | Challenge | Public | captcha tests | covered elsewhere |
| POST | `/api/v1/auth/login` | Session or `MFA_REQUIRED` | Public | `test_auth_mfa_password` | PASS |
| POST | `/api/v1/auth/login/mfa` | TOTP step | Public | same | PASS |
| POST | `/api/v1/auth/password/forgot` | Reset request (no user enumeration) | Public | same | PASS |
| POST | `/api/v1/auth/password/reset` | Consume token | Public | same | PASS |
| POST | `/api/v1/users/me/password` | Change password | Bearer | same | PASS |
| GET | `/api/v1/auth/me` | Session | Bearer | `test_sessions` | PASS |
| GET | `/api/v1/operations/platform-health` | Platform health | Lab open | `test_incidents_p3` | PASS after QT-01 |
| GET | `/api/v1/operations/centre` | Operator console | Lab open | not dedicated; hardened QT-02 | code |
| POST | `/api/v1/incidents/{id}/acknowledge` | Ack | Operator if RBAC | `test_incidents_p3` | 403 PASS |
| GET | `/api/v1/evidence/.../download` | Evidence | RBAC | same | 403/404 PASS |
| GET | `/api/v1/backends` | Fleet | Lab open | openapi/backends tests | subset |
| GET | `/api/v1/health/vector` | Health vector | | `test_health_vector` | PASS in 42-test batch |

Full OpenAPI: `/docs` off in production profile. Remaining routers (jobs, queues, reports, admin, development, governance) covered by other `tests/test_*.py` in the 167-pass set — not re-listed here. Do not treat 200 alone as proof of live provider data when `ENABLE_MOCK_DATA=true`.
