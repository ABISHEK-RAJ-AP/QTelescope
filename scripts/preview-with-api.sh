#!/usr/bin/env bash
# Lab: Vite preview on :4173 with /api proxied — starts API if not already listening.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"

load_env_file "${ROOT}/.env"
if ! curl -sf -m 2 -o /dev/null "http://127.0.0.1:8000/api/v1/auth/captcha" 2>/dev/null; then
  apply_vm_demo_env "$ROOT"
  restart_uvicorn "$ROOT" || exit 1
fi

cd "${ROOT}/frontend"
exec npm run preview -- "$@"