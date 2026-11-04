#!/usr/bin/env bash
# Temporary public URL so other laptops can open the UI without LAN reachability.
# Needs nginx already serving on :80 (setup-nginx-host.sh) + uvicorn on :8000.
# Usage: ./scripts/share-http.sh
set -euo pipefail

PORT="${NGINX_PORT:-4173}"
echo "Checking local nginx on :$PORT ..."
curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "==> Installing cloudflared (user local)..."
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/cloudflared" \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$TMP/cloudflared"
  mkdir -p "$HOME/.local/bin"
  mv "$TMP/cloudflared" "$HOME/.local/bin/cloudflared"
  export PATH="$HOME/.local/bin:$PATH"
  rm -rf "$TMP"
fi

echo ""
echo "Starting quick tunnel. Copy the https://….trycloudflare.com URL"
echo "and open it on the other laptop. Ctrl+C to stop."
echo ""
cloudflared tunnel --url "http://127.0.0.1:${PORT}"
