# Security findings

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| S1 | P1 | Local `.env` bootstrap `quantum2026` + default `SECRET_KEY` | Open for this workstation; prod must rotate |
| S2 | P1 | MFA TOTP secrets in `data/user_mfa.json` | Open |
| S3 | P1 | Password reset: no email; `dev_reset_token` in non-prod | By design lab; prod must not leak tokens |
| S4 | P2 | Passwords PBKDF2-HMAC-SHA256 (120k) with `SECRET_KEY` salt — not argon2 | Acceptable lab; upgrade later |
| S5 | P2 | Sessions memory unless `PERSIST_API_SESSIONS` | Open for multi-worker |
| S6 | P2 | Lab CORS defaults localhost Vite ports | Prod requires explicit `CORS_ORIGINS` |
| S7 | Pass | Open redirect after login blocked (`safePostLoginRedirect`) | Verified pytest |
| S8 | Pass | Security headers middleware | `test_security_headers_and_prod_defaults` |
| S9 | Pass | Auth rate limit | `test_rate_limit` |
| S10 | Pass | Register cannot self-create Admin | pytest |
| S11 | Info | `ENABLE_MOCK_DATA=true` default — simulated fleet, not live QPU | Ops must disable for live |

Hardcoded provider tokens: empty in `.env.example`. Do not commit real IBM/IonQ keys.
