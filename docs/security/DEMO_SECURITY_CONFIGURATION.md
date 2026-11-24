# Demo security configuration (public event)

## Goal

Visitors can **register → OTP in toast → /app/onboarding** while the VM stays on a **production-hardened** API profile (auth, RBAC, security headers, no default passwords).

## Apply

```bash
./scripts/vm-event-public-demo.sh 'https://203.0.113.10'   # or your HTTPS origin
```

Sets (among others):

- `ENVIRONMENT=production`, `EVENT_PUBLIC_DEMO=true`
- `REQUIRE_API_AUTH=true`, `ENFORCE_RBAC=true`
- `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true`
- `ALLOW_PUBLIC_REGISTRATION=true`
- `ENABLE_MOCK_DATA=true`, `HYBRID_DEMO_ENABLED=false` (synthetic booth data)
- `REGISTRATION_OTP_DELIVERY=screen`, `REGISTRATION_REQUIRES_ADMIN_APPROVAL=false`
- Random `ADMIN_PASSWORD` / `USER_PASSWORD` / `SUPERADMIN_PASSWORD`
- `CORS_ORIGINS` and `PUBLIC_APP_URL` = your argument

Operator note file: `data/event-bootstrap-passwords.txt` (paths only; passwords live in `.env`).

After pull on the booth VM use **`./scripts/vm-event-restart.sh`** only — not `vm-demo-restart.sh`.

Optional fail-fast boot: `STARTUP_CONFIG_STRICT=true` in `.env` (production misconfig → process exit).

Behind nginx: `TRUSTED_PROXY_RATE_LIMIT=true` (set by event script) restores per-client registration limits.

## Accepted risks (document for sign-off)

1. **Screen OTP** — `POST .../register/send-otp` may return `screen_otp` in JSON. Anyone who completes captcha can create an Operator account. Mitigate: booth WAF, short event window, post-event `ALLOW_PUBLIC_REGISTRATION=false`.
2. **No email proof** — not suitable for open internet production; OK for time-boxed demo.
3. **Residual DDoS** — app rate limits only; use CDN/firewall for volumetric attacks.

## Do not use on the public internet

- `scripts/vm-demo-env.sh` alone (default `quantum2026`, `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=false`)
- `REQUIRE_API_AUTH=false`
- Exposing PostgreSQL/Redis ports on `0.0.0.0`

## Production gate in code

`app/core/startup_validation.py` logs errors when production has open registration **unless** `EVENT_PUBLIC_DEMO=true` and other mandatory flags are set.