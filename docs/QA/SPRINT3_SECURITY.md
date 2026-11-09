# Sprint 3 — security blockers (wave 1)

**Date:** 2026-11-09  
**Theme:** MFA at rest, bootstrap defaults in production profile

## Shipped

| Item | Evidence |
| --- | --- |
| MFA TOTP Fernet at rest | `app/core/secret_box.py`, `app/core/user_mfa.py` (`secret_enc` field) |
| Lazy plaintext migration | On load when `MFA_ENCRYPT_AT_REST=true` (default) |
| Prod default block default bootstrap password | `block_default_bootstrap_enabled()` uses `env_flag_prod_default_true` |
| Dependency | `cryptography>=42.0.0` in `backend/requirements.txt` |
| Tests | `tests/test_mfa_at_rest.py`, `tests/test_bootstrap_security.py` |

## Env flags

| Variable | Default | Notes |
| --- | --- | --- |
| `MFA_ENCRYPT_AT_REST` | `true` | Set `false` only for legacy lab JSON |
| `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS` | `true` in `QRE_PROFILE=production` | Override explicit for demo VM |

## Wave 2 (QT-08)

| Item | Evidence |
| --- | --- |
| SMTP reset delivery (prod) | `app/core/mail_delivery.py`, `auth.py` forgot (no `dev_reset_token` in prod) |
| Env | `SMTP_*`, `PUBLIC_APP_URL` in `.env.production.example` |
| Tests | `tests/test_password_reset_mail.py` |

## Still open (Sprint 3)
- QT-09 Playwright green on VM
- RBAC/auth enforced by default in prod (warnings only today)
- Backup restore drill
- QT-06: rotate demo `.env` on any internet-facing host
