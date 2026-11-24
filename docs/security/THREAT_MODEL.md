# Threat model (STRIDE) — public event demo

## Assets

- Operator accounts and sessions (`data/`, user store)
- Fleet telemetry (mostly synthetic when `ENABLE_MOCK_DATA=true`)
- Bootstrap admin credentials
- Provider API keys in `.env` (server-side only)

## Trust boundaries

1. Browser (untrusted) → nginx → FastAPI
2. FastAPI → SQLite/PostgreSQL, Redis
3. Collectors → external quantum APIs (disabled/minimized in event script)

## STRIDE summary

| Threat | Exposure | Control |
| --- | --- | --- |
| Spoofing | Stolen session token | Bearer sessions, `SECRET_KEY`, HTTPS |
| Tampering | CSRF on writes | Origin guard, CORS allowlist |
| Repudiation | — | Partial audit logs on admin actions |
| Info disclosure | `screen_otp`, verbose errors | Prod sanitization; OTP risk accepted at booth |
| DoS | Registration flood | Captcha + `AUTH_RATE_LIMIT` |
| Elevation | Default passwords | `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS` |

## Abuse cases

1. Bot registers many Operator accounts → rate limit; disable reg post-event.
2. Guest logs in as admin with `quantum2026` → blocked when event script applied.
3. Anonymous calls destructive admin API → `REQUIRE_API_AUTH` + RBAC.