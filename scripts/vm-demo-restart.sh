#!/usr/bin/env bash
# Lab / demo VM: mock catalog + default admin/researcher login.
# VAPT later: use scripts/vm-vapt-restart.sh and set BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"

echo "==> git pull"
git fetch origin main
if ! git diff --quiet -- scripts/vm-demo-env.sh scripts/vm-demo-restart.sh scripts/vm-update-from-git.sh 2>/dev/null; then
  echo "==> discarding local edits under scripts/vm-*.sh (git stash if you need them)"
  git checkout -- scripts/vm-demo-env.sh scripts/vm-demo-restart.sh scripts/vm-update-from-git.sh 2>/dev/null || true
fi
git pull --ff-only origin main || {
  echo "WARN: ff-only pull failed; resolve conflicts manually" >&2
  echo "Tip: git stash push -m 'vm local' && git pull --ff-only origin main" >&2
  exit 1
}

echo "==> demo .env (mock data + bootstrap accounts)"
apply_vm_demo_env "$ROOT"

echo "==> Stop foreign listeners on :8000 (QRP/other uvicorn)"
stop_foreign_api_port 8000

echo "==> Restart API (must be up before nginx proxy check)"
restart_uvicorn "$ROOT" || exit 1
verify_api_direct || exit 1

echo "==> Frontend nginx (port ${NGINX_PORT:-4173})"
FORCE_FREE_PORT=1 "${ROOT}/scripts/setup-nginx-host.sh"
verify_nginx_api_proxy "${NGINX_PORT:-4173}" || exit 1

echo ""
echo "Demo login: admin / quantum2026  |  superadmin / quantum2026  |  user_researcher / quantum2026"
echo "Mock catalog ON. For VAPT later: ENABLE_MOCK_DATA=false BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true"
STACK_VERIFY_SKIP_INFRA=1 NGINX_PORT="${NGINX_PORT:-4173}" "${ROOT}/scripts/verify-stack.sh"
