#!/usr/bin/env bash
# Lab / demo VM: mock catalog + default admin/researcher login.
# VAPT later: use scripts/vm-vapt-restart.sh and set BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"

echo "==> git pull"
git pull --ff-only origin main

echo "==> demo .env (mock data + bootstrap accounts)"
apply_vm_demo_env "$ROOT"

echo "==> Frontend nginx (port ${NGINX_PORT:-4173})"
FORCE_FREE_PORT=1 "${ROOT}/scripts/setup-nginx-host.sh"

echo ""
echo "Demo login: admin / quantum2026  or  user_researcher / quantum2026"
echo "Mock catalog ON. For VAPT later: ENABLE_MOCK_DATA=false BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true"
echo "==> Restart API"
restart_uvicorn "$ROOT" || exit 1
STACK_VERIFY_SKIP_INFRA=1 "${ROOT}/scripts/verify-stack.sh" || true
