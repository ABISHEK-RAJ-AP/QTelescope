# Auth & account security audit

## Verified (pytest `tests/test_auth_mfa_password.py`, `tests/test_sessions.py`, `tests/test_bootstrap_security.py`)

| Flow | Result |
| --- | --- |
| Register Operator | PASS |
| Register as Admin | PASS (403) |
| Login + session token | PASS |
| MFA enroll then login requires TOTP | PASS |
| Wrong TOTP | PASS (401) |
| Forgot password does not reveal missing user | PASS |
| Reset token single-use | PASS |
| Change password needs current password | PASS |
| Default bootstrap password block (when enabled) | PASS |
| API auth middleware 401 without token | PASS |
| Post-login redirect only `/app` | PASS (`tests/test_safe_post_login_redirect.py`) |

## Implemented this cycle

- Login returns `MFA_REQUIRED` when TOTP enrolled; `POST /auth/login/mfa` completes it.
- `POST /auth/password/forgot` + `/reset`; lab may return `dev_reset_token` (never in production profile).
- `POST /users/me/password` + Settings UI.
- Login UI: MFA step, Forgot password, no `window.location = stored URL`.

## Remaining

| Item | Status |
| --- | --- |
| SMTP delivery of reset mail | Not implemented — lab token only off-prod |
| Idle timeout UI | Session TTL env only (`SESSION_TTL_SECONDS`) |
| Passwords PBKDF2-HMAC-SHA256 120k (`SECRET_KEY` salt) | P2 — argon2 later |
| MFA secrets file `data/user_mfa.json` plaintext | P2 — encrypt at rest |
| Browser E2E login/MFA | BLOCKED — no Playwright run this cycle |
| Rate limit | Exists (memory or Redis) — unit tests present |

## Open redirect

Previously `window.location.href = sessionStorage qre_post_login_redirect`. Now `safePostLoginRedirect` allows `/app…` same-origin only.
