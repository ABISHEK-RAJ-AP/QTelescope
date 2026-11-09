# Security configuration (Q-TeleScope)

Copy `.env.production.example` → `.env` on the VM before VAPT / UAT.

When `ENVIRONMENT=production` or `QRE_PROFILE=production`:
- `REQUIRE_API_AUTH`, `ENFORCE_RBAC`, and `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS` default **ON**
- Interactive `/docs` + OpenAPI are disabled
- Dev login presets are hidden
- API responses include baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, …)

## Production-oriented environment variables

| Variable | Recommended prod | Purpose |
|----------|------------------|---------|
| `ENVIRONMENT` / `QRE_PROFILE` | `production` | Enables prod defaults above |
| `REQUIRE_API_AUTH` | `true` | All `/api/v1/*` routes require `Authorization: Bearer <qtok_*>` (except public auth routes). SSE: `POST /auth/stream-ticket` then `?stream_ticket=` (prod blocks `?access_token=`) |
| `STREAM_TICKET_TTL_SECONDS` | `180` | Opaque SSE ticket lifetime |
| `ENFORCE_RBAC` | `true` | Mutating routes require Operator or Admin role from validated session |
| `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS` | `true` | Rejects login with default password on reserved `superadmin` / `admin` / `user_researcher` accounts |
| `ALLOW_ENV_CREDENTIAL_WRITE` | `false` | Do not write provider tokens into `.env` from Admin UI |
| `CORS_ORIGINS` | your UI origin(s) | Comma-separated; never `*` in production |
| `SUPERADMIN_PASSWORD` / `ADMIN_PASSWORD` / `USER_PASSWORD` | strong unique values | Replace default bootstrap passwords |
| `SECRET_KEY` | random 32+ bytes | Session/password hashing salt source |

## Bootstrap admin

- Admin **cannot** self-register via `/auth/register`.
- Reserved usernames: `SUPERADMIN_USERNAME` (default `superadmin`), `ADMIN_USERNAME` (default `admin`), `USER_USERNAME` (default `user_researcher`). Lab demo passwords default to `quantum2026` — rotate in production.
- Dev login presets on the sign-in page hide when `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true`.

## Sessions (SPA)

- API auth uses **Bearer tokens** (`qtok_*` in `Authorization` header), not browser cookies — no `HttpOnly` session cookie in the default SPA profile.
- If you add cookie-based sessions later, set `Secure`, `HttpOnly`, and `SameSite=Lax` (or `Strict`) on the production domain.

## Password reset

- Reset tokens are single-use, stored in memory, **TTL 900 seconds (15 minutes)** (`app/core/password_reset.py`).
- Production: token is emailed only; lab may return `dev_reset_token` on forgot-password when not in production profile.

## Rate limiting

- `AUTH_RATE_LIMIT` (default 20) and `AUTH_RATE_WINDOW_SEC` (default 60) apply to login and register per client IP.

## Audit

Operator actions (advisory quarantine, etc.) append to `data/audit_events.jsonl`.

See also `GET /api/v1/admin/deployment/profile` → `security.recommended_prod`.
