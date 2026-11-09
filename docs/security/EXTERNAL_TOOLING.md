# External security & UX tooling (Q-TeleScope)

What to use **on the VM/CI** vs defer. This app is **FastAPI + SQLAlchemy + Bearer SPA** — not Better Auth, not Drizzle.

## Install on VM / CI (recommended)

| Tool | Purpose | Command |
| --- | --- | --- |
| [gitleaks](https://github.com/gitleaks/gitleaks) | Secrets in git | `./scripts/run-gitleaks.sh` |
| [trivy](https://github.com/aquasecurity/trivy) | Image/fs CVE scan | `trivy fs .` (optional) |
| [semgrep](https://semgrep.dev) | SAST rules | `semgrep --config auto` (optional) |
| Existing | Default secret strings | `./scripts/scan-default-secrets.sh` |
| Existing | Python/npm audit | `./scripts/run-dependency-audit.sh` |

## Cursor / agent only (not runtime)

| Item | Verdict |
| --- | --- |
| chrome-devtools-mcp | Optional MCP for DOM QA — dev machine only |
| claude-code-security-review | Use `.cursor/skills/security-audit/` pattern |
| react-bits (DavidHDev) | UI snippets — cherry-pick; no full install |
| tweakcn | Theme tokens reference — we use `design-tokens.css` |
| umami / ccusage | Analytics/hosting — **INFRA**, not in app repo |

## Defer (wrong stack or scope)

| Item | Why |
| --- | --- |
| better-auth | We use custom Bearer + sessions in `app/api/auth.py` |
| drizzle-orm | SQLAlchemy + Alembic |
| coolify | Deploy choice on VM; see `scripts/vm-update-from-git.sh` |
| mem0 / opensec | External memory — use Engram locally if needed |
| OWASP ZAP full daemon | Run ad hoc against staging URL, not bundled |

## In-repo mitigations (checklist)

| Risk | Mitigation |
| --- | --- |
| Weak JWT/session secret | `startup_validation.py`, prod warning on default `SECRET_KEY` |
| Open redirect | `safePostLoginRedirect.js` |
| Clickjacking | `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'` |
| User enumeration (forgot password) | Uniform response in `forgot_password` (verify in code review) |
| Source maps in prod | `vite.config.js` → `build.sourcemap: false` |
| SSRF | Admin ingest URL allowlists — review `onprem_adapter` timeouts |
| Path traversal | No user-controlled filesystem paths in API exports |
| Race / session hijack | Server-side sessions; rotate on login — see `app/core/sessions` |

## VM one-liner after pull

```bash
./scripts/vm-update-from-git.sh
./scripts/run-gitleaks.sh || true
./scripts/scan-default-secrets.sh
```
