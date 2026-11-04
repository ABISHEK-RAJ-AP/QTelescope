#!/usr/bin/env bash
# Build frontend + serve via host nginx with optional hostname.
# Usage (inside Guacamole Ubuntu, repo root):
#   chmod +x scripts/setup-nginx-host.sh
#   # API must already be running on :8000 (uvicorn)
#   SERVER_NAME=qtelescope.local ./scripts/setup-nginx-host.sh
#   # or default (any Host / localhost):
#   ./scripts/setup-nginx-host.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_NAME="${SERVER_NAME:-_}"
BUILD_DIST="$ROOT/frontend/dist"
# nginx (www-data) cannot read most home dirs → copy out of $HOME
WWW_ROOT=/var/www/qtelescope
SITE=/etc/nginx/sites-available/qtelescope
ENABLED=/etc/nginx/sites-enabled/qtelescope
TEMPLATE="$ROOT/deployment/nginx-host.conf"

echo "==> Repo: $ROOT"
echo "==> server_name: $SERVER_NAME"

command -v node >/dev/null || { echo "Need Node 20+ (node -v)"; exit 1; }
NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node $(node -v) is too old. Install Node 20+:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt install -y nodejs"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "==> Installing nginx"
  sudo apt update
  sudo apt install -y nginx
fi

echo "==> Building frontend"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run build
test -f "$BUILD_DIST/index.html" || { echo "Build failed: missing $BUILD_DIST/index.html"; exit 1; }

echo "==> Installing static files to $WWW_ROOT (nginx-readable)"
sudo mkdir -p "$WWW_ROOT"
sudo rsync -a --delete "$BUILD_DIST"/ "$WWW_ROOT"/
sudo chown -R root:root "$WWW_ROOT"
sudo find "$WWW_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WWW_ROOT" -type f -exec chmod 644 {} \;

echo "==> Writing nginx site"
TMP="$(mktemp)"
sed -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
    -e "s|__DIST_ROOT__|${WWW_ROOT}|g" \
    "$TEMPLATE" > "$TMP"
sudo cp "$TMP" "$SITE"
rm -f "$TMP"

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn "$SITE" "$ENABLED"

echo "==> Testing & reloading nginx"
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

# LAN access: open firewall port 80 if ufw is active
if command -v ufw >/dev/null 2>&1; then
  if sudo ufw status 2>/dev/null | grep -qi 'Status: active'; then
    echo "==> Opening UFW TCP 80 for LAN"
    sudo ufw allow 80/tcp comment 'qtelescope-nginx' || true
    sudo ufw reload || true
  else
    echo "==> UFW inactive (OK). If still blocked, check cloud/security groups."
  fi
fi

# Quick local check
if curl -fsS -o /dev/null -w '' http://127.0.0.1/healthz 2>/dev/null; then
  echo "==> healthz OK"
else
  echo "==> Warning: healthz not reachable yet (nginx up?)"
fi

LAN_IPS="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9.]+$' | grep -v '^127\.' || true)"

echo ""
echo "Done. Keep uvicorn on :8000 in another terminal."
echo ""
echo "THIS machine only:  http://127.0.0.1   http://localhost"
echo ""
echo "OTHER PCs on same LAN — use THIS VM IP (not localhost):"
if [[ -n "$LAN_IPS" ]]; then
  while read -r ip; do
    [[ -z "$ip" ]] && continue
    echo "  http://${ip}"
  done <<< "$LAN_IPS"
else
  echo "  (run: hostname -I) then open http://THAT_IP"
fi
echo ""
if [[ "$SERVER_NAME" != "_" ]]; then
  echo "Hostname (needs DNS or /etc/hosts on each client):"
  echo "  http://${SERVER_NAME}"
  echo "  On each other PC:  <VM_IP>  ${SERVER_NAME}   →  /etc/hosts or Windows hosts"
  echo ""
fi
echo "If other PCs still fail: Guacamole guest may be NAT'd — its IP is not"
echo "on the office LAN. Then you need host port-forward or run on a real LAN host."