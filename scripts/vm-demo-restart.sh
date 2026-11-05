#!/usr/bin/env bash
# Lab / demo VM: mock catalog + default admin/researcher login.
# VAPT later: use scripts/vm-vapt-restart.sh and set BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

upsert_env() {
  local key="$1" val="$2"
  local envf="${ROOT}/.env"
  touch "$envf"
  if grep -qE "^${key}=" "$envf"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
  else
    printf '%s=%s\n' "$key" "$val" >> "$envf"
  fi
}

echo "==> git pull"
git pull

echo "==> demo .env (mock data + bootstrap accounts)"
upsert_env ENABLE_MOCK_DATA true
upsert_env BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS false
upsert_env ADMIN_USERNAME admin
upsert_env ADMIN_PASSWORD quantum2026
upsert_env USER_USERNAME user_researcher
upsert_env USER_PASSWORD quantum2026

echo "==> Frontend nginx (port ${NGINX_PORT:-4173})"
FORCE_FREE_PORT=1 "${ROOT}/scripts/setup-nginx-host.sh"

echo ""
echo "Demo login: admin / quantum2026  or  user_researcher / quantum2026"
echo "Mock catalog ON. For VAPT later: ENABLE_MOCK_DATA=false BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true"
echo ""
echo "Restart API:"
echo "  pkill -f 'uvicorn app.main:app' || true"
echo "  source .venv/bin/activate 2>/dev/null || true"
echo "  export PYTHONPATH=."
echo "  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
