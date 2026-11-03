# Security configuration (Q-TeleScope)

## Production-oriented environment variables

| Variable | Recommended prod | Purpose |
|----------|------------------|---------|
| `REQUIRE_API_AUTH` | `true` | All `/api/v1/*` routes require `Authorization: Bearer <qtok_*>` (except public auth routes). SSE: `?access_token=` |
| `ENFORCE_RBAC` | `true` | Mutating routes require Operator or Admin role from validated session |
| `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS` | `true` | Rejects login with default password on reserved `admin` / `user_researcher` accounts |
| `ALLOW_ENV_CREDENTIAL_WRITE` | `false` | Do not write provider tokens into `.env` from Admin UI |
| `CORS_ORIGINS` | your UI origin(s) | Comma-separated; default `*` is dev-only |
| `ADMIN_PASSWORD` / `USER_PASSWORD` | strong unique values | Replace default bootstrap passwords |
| `SECRET_KEY` | random 32+ bytes | Session/password hashing salt source |

## Bootstrap admin

- Admin **cannot** self-register via `/auth/register`.
- Reserved usernames: `ADMIN_USERNAME` (default `admin`), `USER_USERNAME` (default `user_researcher`).
- Dev login presets on the sign-in page hide when `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true`.

## Rate limiting

- `AUTH_RATE_LIMIT` (default 20) and `AUTH_RATE_WINDOW_SEC` (default 60) apply to login and register per client IP.

## Audit

Operator actions (advisory quarantine, etc.) append to `data/audit_events.jsonl`.

See also `GET /api/v1/admin/deployment/profile` → `security.recommended_prod`.
