#!/usr/bin/env bash
# Public event VM restart — does not reset bootstrap passwords to quantum2026.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
# shellcheck source=scripts/vm-event-public-demo.sh
source "${ROOT}/scripts/vm-event-public-demo.sh"

if [[ -d "${ROOT}/.git" ]]; then
  echo "==> git pull"
  git pull --ff-only origin main || {
    echo "WARN: ff-only pull failed" >&2
    exit 1
  }
else
  echo "==> No .git — skipping pull (VM zip bundle)"
fi

origin="$(grep -m1 '^PUBLIC_APP_URL=' "${ROOT}/.env" 2>/dev/null | cut -d= -f2- || true)"
if [[ -z "$origin" ]]; then
  origin="$(grep -m1 '^CORS_ORIGINS=' "${ROOT}/.env" 2>/dev/null | cut -d= -f2- || true)"
fi
if [[ -z "$origin" ]]; then
  echo "FAIL: set PUBLIC_APP_URL or CORS_ORIGINS in .env, or re-run vm-event-public-demo.sh <origin>" >&2
  exit 1
fi

echo "==> Re-apply event public-demo .env (origin=${origin})"
apply_vm_event_public_demo_env "$ROOT" "$origin"

stop_foreign_api_port 8000
restart_uvicorn "$ROOT" || exit 1
verify_api_direct || exit 1

FORCE_FREE_PORT=1 "${ROOT}/scripts/setup-nginx-host.sh"
verify_nginx_api_proxy "${NGINX_PORT:-4173}" || exit 1

echo "Event VM restarted. Bootstrap passwords unchanged unless vm-event-public-demo.sh regenerated them."
echo "Do not run vm-demo-restart.sh on a public event host."