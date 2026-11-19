# Condom report: Q-TeleScope

2026-11-19 · mode: full · automated first pass (not legal advice, not a penetration test)

> Review with counsel before relying on legal sections. Professional pentest recommended before internet-facing production at scale.

## What would hurt first

1. **Internet-exposed demo VM** with `REQUIRE_API_AUTH=false`, default `quantum2026` passwords, and open `/register` → anyone could use the console or create Operator accounts. **Fix:** VAPT profile (`vm-vapt-restart.sh` flags) + unique passwords; demo script unchanged for lab only. **Who:** owner.
2. **Missing real privacy/terms** (footer pointed at `/#faq`) → weak compliance story for a product collecting email/username. **Fix:** `/privacy`, `/terms`, `/security` pages (DRAFT). **Who:** owner + legal review.
3. **No payment surface** — no card/webhook risk in codebase today. **Clear.**

## Do these now (owner)

- [ ] On any **internet-facing** host: `ENVIRONMENT=production`, `REQUIRE_API_AUTH=true`, `ENFORCE_RBAC=true`, `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true`, `ALLOW_PUBLIC_REGISTRATION=false`, rotate `SECRET_KEY`, set `CORS_ORIGINS`, change bootstrap passwords away from `quantum2026`.
- [ ] Rotate provider API keys if they were ever pasted in chat, tickets, or committed files (`.env` is gitignored — verify history).
- [ ] Have C-DAC legal review DRAFT policies on `/privacy` and `/terms`.

## The app

| Signal | Evidence |
|--------|----------|
| Stack | FastAPI + React/Vite ops console (`app/`, `frontend/`) |
| Auth | Bearer sessions (`app/core/sessions.py`, `ApiAuthMiddleware`) |
| Data | SQLite/PG; user store; quantum telemetry in DB |
| Money | **None** (no Stripe/payment code) |
| Trackers | **None** in frontend (no gtag/posthog) |
| AI | Collectors call vendor quantum APIs server-side only |
| Users | B2B/lab operators; possible EU if marketed — **assumed India/lab primary** |
| Live checks | Not run against user's production URL this session |

**Assumptions (no owner reply):** lab/demo deployment primary; not aimed at under-13; modest user count; org deployment not consumer SaaS billing.

## Security findings

| # | Finding | Status | Severity | Where |
|---|---------|--------|----------|-------|
| 1 | Open registration on public deployments (SEC-ABUSE-02) | CONFIRMED → **fixed** | Medium | `app/api/auth.py` `/register` |
| 2 | Demo defaults: auth optional, known bootstrap password | LIKELY (config) | High | `scripts/vm-demo-env.sh`, `.env.example` |
| 3 | Provider secrets in browser bundle (SEC-SECRET-01) | CLEAR | — | Only `VITE_API_URL` in frontend |
| 4 | `.env` committed | CLEAR | — | `.gitignore` `*.env` |
| 5 | Admin routes without auth when `REQUIRE_API_AUTH=false` | LIKELY (config) | High | `app/core/api_auth.py` |
| 6 | Payment / client-trusted totals (SEC-PAY-01) | CLEAR | — | No payments |
| 7 | IDOR on backend rows | CLEAR | — | Shared fleet model; RBAC by role when auth on |
| 8 | Auth rate limits | CLEAR | — | `app/core/rate_limit.py` |
| 9 | Write rate limits | CLEAR | — | `app/core/write_rate_middleware.py` |
| 10 | SSE `access_token` query legacy | CLEAR (prod) | Low | Blocked in production (`test_stream_ticket_sse.py`) |
| 11 | OpenAPI `/docs` in production | CLEAR | — | Disabled when `is_production_profile()` |
| 12 | Captcha on login/register | CLEAR | — | `app/api/auth.py` |
| 13 | Security headers | CLEAR | — | `SecurityHeadersMiddleware` |

### 1. Open registration (SEC-ABUSE-02) — fixed

- **What could happen:** Anonymous users create Operator accounts on an exposed API.
- **Evidence:** `POST /api/v1/auth/register` had no deployment gate; captcha only slows abuse.
- **Fix:** `app/core/registration_policy.py`; production default off; `ALLOW_PUBLIC_REGISTRATION=true` only on demo VM.
- **Re-test:** `tests/test_public_registration.py`.

### 2. Lab demo configuration (owner)

- **What could happen:** LAN/internet visitors log in as `admin` / `quantum2026` and read fleet data.
- **Evidence:** `vm-demo-env.sh` sets `BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS false`, auth flags unset.
- **Fix:** Use demo script **only on trusted lab networks**; use `vm-vapt-restart.sh` checklist for exposure.
- **Who:** owner.

## Legal findings

### Applies now (lab/product, collects account + email)

| Gap | Exposure | Fix |
|-----|----------|-----|
| Privacy policy missing (LAW-PRIV-01) | Medium | DRAFT `/privacy` — **lawyer review** |
| Terms missing (LAW-TERMS-01) | Medium | DRAFT `/terms` |
| Misleading legal footer links | Low | Was `/#faq` — now real routes |

### Doesn't apply yet (typical)

| Law | Why not |
|-----|---------|
| GDPR full DPIA | No EU marketing confirmed; B2B lab default |
| COPPA | Not child-directed |
| PCI | No card data |
| CAN-SPAM commercial campaigns | No marketing email pipeline in app |

### Couldn't tell

| Question | Why |
|----------|-----|
| Public URL reachable from internet? | Determines urgency of demo defaults |
| EU/UK users? | GDPR scope |

## Checked and clear (ten-item pass)

1. No payment secrets in client — CLEAR  
2. DB row policies N/A (SQLAlchemy app DB, not Supabase) — N/A  
3. No PAY-01 — CLEAR  
4. No PAY-02/03 — CLEAR  
5. API auth middleware when `REQUIRE_API_AUTH=true` — CLEAR  
6. Backend IDOR — CLEAR for current model  
7. Auth rate limits — CLEAR  
8. Repo secrets — CLEAR (`.env` ignored)  
9. No ad trackers — CLEAR  
10. No subscriptions — CLEAR  

## Not checked

| What | Why |
|------|-----|
| Live pentest / OWASP ZAP | Out of scope |
| Dependency CVE sweep | Not run this session |
| Git history secret scan | Owner can run `gitleaks` |

## Fix log

| Finding | Change | Re-test | Commit |
|---------|--------|---------|--------|
| SEC-ABUSE-02 | Registration policy + tests + UI gate | `pytest tests/test_public_registration.py` | pending |
| LAW-PRIV/TERMS | Legal pages + footer links | Manual `/privacy` | pending |

## Still open (owner)

- Production env hardening on any public VM  
- Legal review of DRAFT policies  
- Optional: fail-fast `validate_startup_configuration()` raise (today: logs only)