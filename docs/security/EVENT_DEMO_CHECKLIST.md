# Event public-VM security checklist

Use this before exposing Q-TeleScope on a **public IP** for a live demo. Mark each row only after you have evidence (command output, config snippet, or test name).

## Profile selection

| Check | Lab / LAN only | Internet event demo | VAPT / no self-register |
| --- | --- | --- | --- |
| Script | `scripts/vm-demo-env.sh` | `scripts/vm-event-public-demo.sh <origin>` | `scripts/vm-vapt-restart.sh` |
| `ENVIRONMENT` | unset or `development` | `production` | `production` |
| `EVENT_PUBLIC_DEMO` | — | `true` | — |
| `ALLOW_PUBLIC_REGISTRATION` | `true` | `true` | `false` |
| Bootstrap passwords | `quantum2026` (trusted LAN) | **unique** (script-generated) | **unique** |
| Registration OTP | `screen` / toast | `screen` (**accepted risk**) | off / SMTP |

## Mandatory before go-live (event demo)

| # | Control | How to verify | Status |
| --- | --- | --- | --- |
| 1 | Unique `SECRET_KEY` (32+ bytes) | `openssl rand -hex 32` in `.env` | NOT VERIFIED |
| 2 | `REQUIRE_API_AUTH=true` | `/api/v1/*` without token → 401 | PASS (code + tests) |
| 3 | `ENFORCE_RBAC=true` | `tests/test_org_user_admin.py` | PASS (16 tests run) |
| 4 | `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true` | login `quantum2026` → 403 | PASS (code) |
| 5 | Explicit `CORS_ORIGINS` (no `*`) | `startup_validation.py` | PASS (code) |
| 6 | `E2E_CAPTCHA_BYPASS=false` | grep `.env` | NOT VERIFIED |
| 7 | OpenAPI `/docs` off in prod | `is_production_profile()` | PASS (code) |
| 8 | Security headers middleware | `SecurityHeadersMiddleware` | PASS (code) |
| 9 | Rate limits on auth writes | `AUTH_RATE_LIMIT` | Config on event script |
| 10 | DB/Redis **not** on public ports | `ss -lnt` + cloud SG | NOT VERIFIED |
| 11 | API `:8000` not public (nginx proxy only) | external nmap | NOT VERIFIED |
| 12 | HTTPS termination (reverse proxy) | TLS cert valid | NOT VERIFIED |
| 13 | `ENABLE_MOCK_DATA=true` (synthetic fleet) | config-status JSON | NOT VERIFIED |
| 14 | No real infra control for anon users | RBAC + mock collectors | PARTIAL (review ops routes) |
| 15 | Post-event: revoke VM, rotate secrets | runbook below | NOT VERIFIED |

## A–Z coverage snapshot (automated / repo)

| Cat | Result | Notes |
| --- | --- | --- |
| AuthN/Z | PASS (configurable) | Weak if `REQUIRE_API_AUTH=false` — blocked in event profile |
| Secrets in repo | NOT VERIFIED | `gitleaks` not installed on this host |
| Dependencies | CONDITIONAL | npm `vitest`/`tinypool` **dev-only**; pip-audit skipped |
| Injection | NOT VERIFIED | SAST (bandit) not run — install in venv on VM |
| CSRF/CORS | PASS (code) | Origin guard + explicit CORS |
| Default passwords | FAIL on `vm-demo-env` alone | Use **event** or **VAPT** script |
| Screen OTP abuse | ACCEPTED RISK | Bots can register after captcha; booth mitigation: WAF/rate limit |

## Commands on the VM (after git pull)

```bash
./scripts/vm-event-public-demo.sh 'https://YOUR_PUBLIC_HOST'
./scripts/scan-default-secrets.sh
./scripts/run-gitleaks.sh          # install gitleaks first
./scripts/run-dependency-audit.sh  # pip-audit in venv recommended
python -m pytest tests/test_public_registration.py tests/test_org_user_admin.py -q
```

## Emergency

- Stop API: `pkill -f 'uvicorn app.main:app'`
- Close firewall: `ufw deny 80; ufw deny 443` (adjust for your setup)
- See [POST_EVENT_CLEANUP.md](./POST_EVENT_CLEANUP.md)