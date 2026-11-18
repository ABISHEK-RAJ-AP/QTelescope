#!/usr/bin/env bash
# Build frontend + serve via host nginx (same port Vite preview used).
# Usage (Guacamole Ubuntu, repo root):
#   # stop any: npx vite preview / npm run preview  (frees 4173)
#   # uvicorn must be on :8000
#   ./scripts/setup-nginx-host.sh
#   # optional:
#   SERVER_NAME=qtelescope.local NGINX_PORT=4173 ./scripts/setup-nginx-host.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
SERVER_NAME="${SERVER_NAME:-_}"
# Default 4173 — your LAN already reaches Vite on this port; :80 often filtered
NGINX_PORT="${NGINX_PORT:-4173}"
API_UPSTREAM="${TELESCOPE_API_UPSTREAM:-127.0.0.1:8000}"
BUILD_DIST="$ROOT/frontend/dist"
WWW_ROOT=/var/www/qtelescope
SITE=/etc/nginx/sites-available/qtelescope
ENABLED=/etc/nginx/sites-enabled/qtelescope
TEMPLATE="$ROOT/deployment/nginx-host.conf"

echo "==> Repo: $ROOT"
echo "==> server_name: $SERVER_NAME"
echo "==> listen port: $NGINX_PORT"

command -v node >/dev/null || { echo "Need Node 20+ (node -v)"; exit 1; }
NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node $(node -v) is too old. Install Node 20+."
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "==> Installing nginx"
  sudo apt update
  sudo apt install -y nginx
fi

if ss -lntp 2>/dev/null | grep -qE ":${NGINX_PORT}[[:space:]]"; then
  echo "==> Port $NGINX_PORT in use"
  ss -lntp 2>/dev/null | grep -E ":${NGINX_PORT}[[:space:]]" || true
  if [[ "${FORCE_FREE_PORT:-}" == "1" ]]; then
    echo "==> Freeing $NGINX_PORT from Node/Vite (keeping nginx)"
    free_lab_port "$NGINX_PORT"
  fi
fi

echo "==> Building frontend"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run build
test -f "$BUILD_DIST/index.html" || { echo "Build failed: missing $BUILD_DIST/index.html"; exit 1; }

echo "==> Installing static files to $WWW_ROOT"
sudo mkdir -p "$WWW_ROOT"
sudo rsync -a --delete "$BUILD_DIST"/ "$WWW_ROOT"/
sudo chown -R root:root "$WWW_ROOT"
sudo find "$WWW_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WWW_ROOT" -type f -exec chmod 644 {} \;

echo "==> Writing nginx site (port $NGINX_PORT)"
TMP="$(mktemp)"
sed -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
    -e "s|__DIST_ROOT__|${WWW_ROOT}|g" \
    -e "s|__LISTEN_PORT__|${NGINX_PORT}|g" \
    -e "s|__API_UPSTREAM__|${API_UPSTREAM}|g" \
    "$TEMPLATE" > "$TMP"
sudo cp "$TMP" "$SITE"
rm -f "$TMP"

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn "$SITE" "$ENABLED"

echo "==> Testing & starting nginx"
sudo nginx -t
sudo systemctl enable nginx
free_lab_port "$NGINX_PORT"
sudo systemctl restart nginx
sleep 1
ensure_nginx_ui_port "$NGINX_PORT" || exit 1
if ! nginx_ui_ok "$NGINX_PORT"; then
  echo "==> Retrying nginx after port clear"
  free_lab_port "$NGINX_PORT"
  sudo fuser -k "${NGINX_PORT}/tcp" 2>/dev/null || true
  sleep 2
  sudo systemctl restart nginx
  sleep 1
  ensure_nginx_ui_port "$NGINX_PORT" || exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  if sudo ufw status 2>/dev/null | grep -qi 'Status: active'; then
    echo "==> Opening UFW TCP $NGINX_PORT"
    sudo ufw allow "${NGINX_PORT}/tcp" comment 'qtelescope-nginx' || true
    sudo ufw reload || true
  fi
fi

if ! nginx_ui_ok "$NGINX_PORT"; then
  echo "FAIL: nginx healthz on :${NGINX_PORT}" >&2
  sudo tail -20 /var/log/nginx/error.log 2>/dev/null || true
  exit 1
fi
echo "==> healthz OK on :${NGINX_PORT}"

echo "==> Verify /api/v1 proxy (needs Q-TeleScope uvicorn on :${API_UPSTREAM##*:})"
verify_nginx_api_proxy "$NGINX_PORT"

LAN_IPS="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9.]+$' | grep -v '^127\.' || true)"

echo ""
echo "Done. Keep uvicorn on :8000. Do NOT run vite preview (nginx owns $NGINX_PORT)."
echo ""
echo "THIS machine:  http://127.0.0.1:${NGINX_PORT}"
echo ""
echo "OTHER laptops (same as old vite URL, now nginx+API proxy):"
if [[ -n "$LAN_IPS" ]]; then
  while read -r ip; do
    [[ -z "$ip" ]] && continue
    echo "  http://${ip}:${NGINX_PORT}"
  done <<< "$LAN_IPS"
else
  echo "  http://10.184.61.130:${NGINX_PORT}"
fi
echo ""
if [[ "$SERVER_NAME" != "_" ]]; then
  echo "Named URL (each laptop /etc/hosts → VM IP):"
  echo "  http://${SERVER_NAME}:${NGINX_PORT}"
fi
