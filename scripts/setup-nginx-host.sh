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

# Quick local check
if curl -fsS -o /dev/null -w '' http://127.0.0.1/healthz 2>/dev/null; then
  echo "==> healthz OK"
else
  echo "==> Warning: healthz not reachable yet (nginx up?)"
fi

echo ""
echo "Done. Keep uvicorn on :8000 in another terminal."
echo ""
if [[ "$SERVER_NAME" == "_" ]]; then
  echo "Open in Guacamole browser:"
  echo "  http://127.0.0.1"
  echo "  http://localhost"
  echo ""
  echo "To use a hostname next time:"
  echo "  SERVER_NAME=myname.local $0"
else
  echo "Open (if DNS /hosts points here):"
  echo "  http://${SERVER_NAME}"
  echo ""
  echo "On THIS VM only, also works:"
  echo "  http://127.0.0.1"
  echo "  http://localhost"
  echo ""
  echo "Optional /etc/hosts on this VM:"
  echo "  echo '127.0.0.1 ${SERVER_NAME}' | sudo tee -a /etc/hosts"
fi
