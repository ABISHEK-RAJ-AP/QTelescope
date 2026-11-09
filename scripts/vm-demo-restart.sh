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

# Fix bad paste e.g. SECRET_KEY=<openssl rand -hex 32> or backticks on one line
ensure_secret_key() {
  local envf="${ROOT}/.env"
  touch "$envf"
  local sk=""
  sk=$(grep -m1 '^SECRET_KEY=' "$envf" 2>/dev/null | cut -d= -f2- || true)
  if [[ -z "$sk" || "$sk" == *'<'* || "$sk" == *'`'* || ${#sk} -lt 32 ]]; then
    sk=$(openssl rand -hex 32)
    upsert_env SECRET_KEY "$sk"
    echo "SECRET_KEY reset (previous value was missing or invalid — use openssl rand -hex 32, not shell redirection in .env)"
  fi
}

ensure_sqlite_if_no_postgres() {
  local envf="${ROOT}/.env"
  local db=""
  db=$(grep -m1 '^DATABASE_URL=' "$envf" 2>/dev/null | cut -d= -f2- || true)
  if [[ "$db" == postgresql* ]] && ! command -v pg_isready >/dev/null 2>&1; then
    upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
    upsert_env USE_ALEMBIC "true"
    echo "DATABASE_URL → sqlite (pg_isready not available on VM)"
  elif [[ "$db" == postgresql* ]] && ! pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
    upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
    echo "DATABASE_URL → sqlite (PostgreSQL not running; start scripts/start-local-infra.sh for Postgres)"
  elif [[ -z "$db" ]]; then
    upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
  fi
}

echo "==> git pull"
git pull

echo "==> demo .env (mock data + bootstrap accounts)"
ensure_secret_key
ensure_sqlite_if_no_postgres
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
echo "==> Restart API"
pkill -f 'uvicorn app.main:app' 2>/dev/null || true
sleep 1
export PYTHONPATH="${ROOT}"
# ponytail: only export valid KEY=val lines — broken .env lines must not abort bash
if [[ -f .env ]]; then
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    [[ "$line" == *'<'* || "$line" == *'`'* ]] && continue
    export "$line"
  done < .env
  set +a
fi
if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
mkdir -p "${ROOT}/data"
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "${ROOT}/.backend.log" 2>&1 &
echo "API log: ${ROOT}/.backend.log"
sleep 2
STACK_VERIFY_SKIP_INFRA=1 "${ROOT}/scripts/verify-stack.sh" || true
