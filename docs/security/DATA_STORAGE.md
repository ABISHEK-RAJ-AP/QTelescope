# Data storage and secrets (Q-TeleScope)

Operator-facing summary of what is persisted, where, and how it is protected. Update this when storage paths or encryption behavior changes.

## Provider API keys (IBM, IonQ, stubs)

| Aspect | Behavior |
| --- | --- |
| **On disk** | `data/provider_credentials.json` (gitignored) |
| **Format** | `token_enc` — Fernet blob from `SECRET_KEY` via `app/core/secret_box.py` (same scheme as MFA). Legacy plaintext `token` rows migrate to `token_enc` on load. |
| **Process env** | Live adapters also read vendor env vars (`IBM_QUANTUM_TOKEN`, etc.). Optional `.env` write when `ALLOW_ENV_CREDENTIAL_WRITE=true` (default **off** in production). |
| **Retained after restart** | Yes — encrypted JSON always updated on save (live and stub). Env vars apply if `.env` write allowed or set manually. |
| **Admin API** | `GET /api/v1/admin/credentials` returns flags and non-secret `public_fields` only — **never** API tokens. |

## User passwords and PII

| Data | Storage |
| --- | --- |
| **Passwords** | PBKDF2-HMAC-SHA256 (120k iterations), salt from `SECRET_KEY` — `data/registered_users.json` / SQLite user tables (no plaintext). |
| **Registration OTP pending** | In-memory pending map with `password_hash`, not plaintext password. |
| **Profile** | Username, email, org, role in DB/JSON; returned by `/auth/me` without password fields. |
| **MFA TOTP** | `data/user_mfa.json` — encrypted secret when `MFA_ENCRYPT_AT_REST=true` (default). |

## Session tokens (browser)

| Aspect | Behavior |
| --- | --- |
| **Server** | `qtok_*` sessions in memory; optional `data/api_sessions.json` when `PERSIST_API_SESSIONS=true`. |
| **Browser** | `localStorage.quantum_user` holds session token + minimal profile for console UX — **XSS on origin can exfiltrate**. Harden with workstation discipline; httpOnly cookies are not implemented. |

## Logs and audit

Structured app logs redact context keys matching `password`, `token`, `secret`, `mfa`, `api_key`, `authorization` (`app/core/app_structured_log.py`).

## Demo / VM hardening pointers

- Rotate `SECRET_KEY` before public demos (re-encrypts Fernet-backed blobs).
- Set `ALLOW_ENV_CREDENTIAL_WRITE=false` on internet-facing VMs.
- See `docs/security/EVENT_DEMO_CHECKLIST.md`.