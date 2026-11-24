# Deployment runbook — public event

1. Provision VM (patched OS, non-root deploy user).
2. Clone repo; never commit `.env`.
3. `./scripts/vm-event-public-demo.sh 'https://<public-origin>'`
4. `./scripts/setup-nginx-host.sh` (or existing nginx site) — proxy `/api` to `127.0.0.1:8000`, serve static UI.
5. TLS: certbot or org CA on nginx.
6. Firewall: allow 22 from admin IP only; 80/443 public; deny 5432, 6379, 8000 from WAN.
7. `restart_uvicorn` via `scripts/vm-demo-restart.sh`.
8. Smoke: register flow, login, dashboard load.
9. Monitor disk, CPU, `.backend.log`.
10. Post-event: [POST_EVENT_CLEANUP.md](./POST_EVENT_CLEANUP.md)