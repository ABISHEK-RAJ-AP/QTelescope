# Final release readiness — public event VM

**Decision: CONDITIONAL GO** (as of audit pass in repo; VM/network checks still owner-verified)

## Verified in repository (evidence)

| Area | Result | Evidence |
| --- | --- | --- |
| API auth middleware | PASS | `ApiAuthMiddleware`, `tests/test_sessions.py` patterns |
| RBAC / org admin | PASS | `tests/test_org_user_admin.py` (16 passed) |
| Public registration gate | PASS | `tests/test_public_registration.py` |
| Registration OTP | PASS | `tests/test_registration_otp.py` (5) |
| Bootstrap default password block | PASS | `tests/test_bootstrap_security.py` |
| Event demo startup gate | PASS | `tests/test_startup_event_demo.py` |
| Security headers / CSP | PASS | `CONDOM-REPORT.md`, middleware |
| Frontend secrets in bundle | PASS | No provider keys in Vite env |
| Open registration policy | PASS | `registration_policy.py` |

## Not verified (mandatory on target VM)

| Area | Owner action |
| --- | --- |
| gitleaks history scan | Install + `./scripts/run-gitleaks.sh` |
| pip-audit / bandit | venv on VM |
| Firewall: only 80/443 public | `ufw` + cloud SG |
| TLS certificate | reverse proxy |
| HTTPS redirect | nginx/caddy |
| Backup / rollback drill | DB + `.env` backup |
| Independent second agent review | optional second Cursor session |

## npm audit note

`tinypool` / `vitest` findings are **development dependencies** (not shipped in `npm run build`). Runtime frontend bundle audit: **no critical runtime npm CVE verified this session**. Track upgrade vitest 5.x separately.

## Deployment steps (owner approval required)

1. `git pull` on isolated demo VM (not production fleet).
2. `./scripts/vm-event-public-demo.sh 'https://<your-host>'`
3. Build UI + nginx: `./scripts/setup-nginx-host.sh` / `vm-demo-restart.sh`
4. Confirm `curl -s https://<host>/api/v1/auth/config-status` (via proxy)
5. Run checklist in [EVENT_DEMO_CHECKLIST.md](./EVENT_DEMO_CHECKLIST.md)
6. After event: [POST_EVENT_CLEANUP.md](./POST_EVENT_CLEANUP.md)

## Residual risk summary

- Anonymous self-registration with screen OTP while event flag is on.
- No guarantee of zero unknown vulnerabilities (no full pentest run).
- DDoS at network edge still required.

**Do not deploy until owner reads CONDITIONAL GO and completes NOT VERIFIED items.**