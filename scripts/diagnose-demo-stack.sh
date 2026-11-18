#!/usr/bin/env bash
# Quick LAN demo diagnosis (run on VM).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
PORT="${NGINX_PORT:-4173}"

echo "=== :8000 (API) ==="
ss -lntp 2>/dev/null | grep -E ':8000[[:space:]]' || echo "(not listening)"
echo -n "config-status direct: "
curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/v1/auth/config-status || echo "fail"
qtelescope_api_ok "http://127.0.0.1:8000" && echo "Q-TeleScope API: yes" || echo "Q-TeleScope API: NO (wrong app or down)"

echo "=== :${PORT} (UI) ==="
ss -lntp 2>/dev/null | grep -E ":${PORT}[[:space:]]" || ss -lnt 2>/dev/null | grep -E ":${PORT}[[:space:]]" || echo "(not listening)"
echo -n "healthz: "
curl -sf -m 5 "http://127.0.0.1:${PORT}/healthz" 2>/dev/null || echo "fail"
echo
nginx_ui_ok "$PORT" && echo "nginx UI: yes" || echo "nginx UI: NO (vite or stale listener)"
echo -n "config-status via nginx: "
curl -s -m 5 -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:${PORT}/api/v1/auth/config-status" || echo "fail"

echo "=== nginx site (api block) ==="
sudo grep -E 'listen|location.*api|proxy_pass' /etc/nginx/sites-enabled/qtelescope 2>/dev/null || echo "(no site file)"