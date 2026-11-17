# Q-TeleScope vs Quantum Resource Portal (QRP)

These are **separate products**. Do not deploy or develop them as one application.

| | **Q-TeleScope** | **QRP (Govern)** |
| --- | --- | --- |
| UI | `frontend/` (Vite, port 5173) | `apps/govern/` (Vite, port 5175, often `/govern/`) |
| API surface | Monitoring, alerts, jobs, telemetry (`app/` except governance-only routes) | Resource governance (`app/api/governance/*`) |
| VM update script | `scripts/vm-update-from-git.sh` builds **TeleScope** `frontend/` only | Build Govern separately: `cd apps/govern && npm ci && npm run build` |
| Start (dev) | `scripts/dev-up.sh` / backend + `frontend` | `scripts/start-qrp.sh` (optional sibling repo) |

Shared monorepo folder is for **API convenience only**. Product commits for TeleScope should touch `frontend/` + core monitoring backend, not Govern UI, unless you are explicitly shipping QRP.

**Previous push note:** commit `a15769e` bundled Govern work for lab convenience. Future TeleScope-only fixes should stay in `frontend/` and monitoring paths.