# Q-TeleScope VM deployment bundle

Offline-friendly package: FastAPI backend, prebuilt React UI, nginx site template, SQLite by default (PostgreSQL optional).

## System requirements

| Component | Version |
| --- | --- |
| OS | Linux x86_64 (Debian/Ubuntu recommended; others: manual nginx) |
| Python | 3.10+ |
| Node.js | 20+ (only if you rebuild the UI; prebuilt `frontend/dist` is included) |
| nginx | 1.18+ (installed by `setup.sh` on apt-based systems) |
| Optional | PostgreSQL 15+, Redis 6+ |

## Install OS packages (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx curl openssl rsync
# Optional database cache:
# sudo apt install -y postgresql redis-server
# Node (only to rebuild UI):
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
# sudo apt install -y nodejs
```

## Quick setup (interactive)

```bash
unzip Q-TeleScope-*.zip
cd Q-TeleScope-*
chmod +x setup.sh
./setup.sh
```

The script asks for:

- Public URL (for CORS and password-reset links)
- UI listen port (default `4173`)
- SQLite vs PostgreSQL
- Demo/event profile vs production-hardened profile
- Bootstrap admin passwords (or auto-generated)
- Optional SMTP (registration OTP + password reset by email)

## After setup

| Service | Default |
| --- | --- |
| API | `http://127.0.0.1:8000` |
| UI (nginx) | `http://<host>:4173` |
| Health | `curl -s http://127.0.0.1:8000/api/v1/health/live` |

Restart API:

```bash
source .venv/bin/activate
export PYTHONPATH=.
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > .backend.log 2>&1 &
```

Reinstall nginx site:

```bash
NGINX_PORT=4173 ./scripts/setup-nginx-host.sh
```

## Organisation registration model

- **New organisation** on `/register` → first account is **OrgAdmin** (organisation owner).
- **Existing organisation** → self-register blocked; org admin must **invite** users under Administration → Access.
- **Platform administrator** → environment bootstrap accounts (`admin` / `superadmin` from `.env`), not public register.

## SMTP (when credentials are available)

Add to `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@example.com
PUBLIC_APP_URL=https://your-public-host
REGISTRATION_OTP_DELIVERY=auto
```

With `ENABLE_MOCK_DATA=false` and SMTP set, registration OTP is sent by email instead of on-screen toast.

## Security notes for internet-facing VMs

- Use `./scripts/vm-event-public-demo.sh <https-origin>` for event booths (see `scripts/vm-vapt-restart.sh` for locked-down VAPT).
- Do not expose PostgreSQL/Redis ports on `0.0.0.0`.
- Rotate `SECRET_KEY` and bootstrap passwords after the event.

## Troubleshooting

- **502 on /api**: API not running on `:8000` — check `.backend.log`.
- **Blank UI**: confirm `frontend/dist` exists and nginx `root` points to `/var/www/qtelescope`.
- **CORS errors**: set `CORS_ORIGINS` to your exact browser origin (scheme + host + port).

Bundle revision: see `VERSION.txt`.