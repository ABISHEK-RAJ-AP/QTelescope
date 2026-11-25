#!/usr/bin/env bash
# Local dev only: Postgres + Redis, trimmed mock data, API :8000, Vite :5173, smoke checks.
# Usage: bash scripts/local-lab-restart.sh
# Options: SKIP_TRIM=1  SKIP_FRONTEND=1  LOCAL_TRIM_AGGRESSIVE=1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/miniforge3/bin:${PATH:-}"

# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
# shellcheck source=scripts/vm-ensure-redis-cache.sh
source "${ROOT}/scripts/vm-ensure-redis-cache.sh"

upsert_env_key() {
  local key="$1" val="$2"
  local envf="${ROOT}/.env"
  touch "$envf"
  if grep -qE "^${key}=" "$envf"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
  else
    printf '%s=%s\n' "$key" "$val" >>"$envf"
  fi
}

echo "==> PostgreSQL + Redis"
"$ROOT/scripts/start-local-infra.sh"

PW="${POSTGRES_PASSWORD:-root}"
DB_URL="postgresql+psycopg2://postgres:${PW}@127.0.0.1:5432/quantum_telemetry"
upsert_env_key DATABASE_URL "$DB_URL"
upsert_env_key USE_ALEMBIC true
upsert_env_key QTELESCOPE_KEEP_DATABASE_URL true

echo "==> Demo/local .env (mock catalog, Redis cache, lab logins)"
apply_vm_demo_env "$ROOT"
ensure_redis_cache "$ROOT"

upsert_env_key COLLECTION_SCHEDULER_ENABLED false
upsert_env_key E2E_CAPTCHA_BYPASS true
upsert_env_key TELEMETRY_RETENTION_ON_STARTUP true
if [[ "${LOCAL_TRIM_AGGRESSIVE:-0}" == "1" ]]; then
  upsert_env_key TELEMETRY_RETENTION_DAYS 7
  upsert_env_key DEMO_RETENTION_DAYS 7
  upsert_env_key DEMO_TELEMETRY_CAP_PER_BACKEND 1200
  upsert_env_key DEMO_BACKEND_TELEMETRY_CAP 300
else
  upsert_env_key TELEMETRY_RETENTION_DAYS 14
  upsert_env_key DEMO_RETENTION_DAYS 14
  upsert_env_key DEMO_TELEMETRY_CAP_PER_BACKEND 2000
  upsert_env_key DEMO_BACKEND_TELEMETRY_CAP 400
fi

load_env_file "${ROOT}/.env"
export PYTHONPATH="$ROOT"

PY=""
if [[ -x "${ROOT}/.venv/bin/python" ]] && "${ROOT}/.venv/bin/python" -c "import uvicorn" 2>/dev/null; then
  PY="${ROOT}/.venv/bin/python"
elif [[ -x "${HOME}/miniforge3/bin/python" ]]; then
  PY="${HOME}/miniforge3/bin/python"
  if ! "$PY" -c "import uvicorn" 2>/dev/null; then
    echo "==> Installing Python deps (miniforge)"
    "$PY" -m pip install -q -r "${ROOT}/backend/requirements.txt"
  fi
else
  PY="$(command -v python3)"
fi

if [[ "${USE_ALEMBIC:-true}" == true ]] && command -v alembic >/dev/null 2>&1; then
  echo "==> Alembic upgrade head"
  alembic upgrade head
fi

if [[ "${SKIP_TRIM:-0}" != "1" ]]; then
  echo "==> Telemetry trim (faster local UI)"
  "$ROOT/scripts/vm-demo-trim.sh" || echo "WARN: trim failed — continuing" >&2
fi

echo "==> Demo fleet refresh (bounded mock telemetry if empty/stale)"
if ! "$PY" "${ROOT}/scripts/refresh_demo_fleet.py" --force; then
  echo "WARN: demo refresh incomplete (e.g. optional mock backend missing) — continuing" >&2
fi

stop_uvicorn_if_foreign() {
  if qtelescope_api_ok "http://127.0.0.1:8000"; then
    return 0
  fi
  if ss -ltn 2>/dev/null | grep -q ':8000 '; then
    echo "WARN: port 8000 busy — not Q-TeleScope API" >&2
    return 1
  fi
  return 0
}

if ! qtelescope_api_ok "http://127.0.0.1:8000" 2>/dev/null; then
  stop_uvicorn_if_foreign || exit 1
  pkill -f "uvicorn app.main:app.*8000" 2>/dev/null || true
  sleep 1
  echo "==> API :8000"
  nohup "$PY" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 \
    >"${ROOT}/.backend.log" 2>&1 &
else
  echo "==> API already up :8000"
fi

for i in $(seq 1 50); do
  if qtelescope_api_ok "http://127.0.0.1:8000"; then
  break
  fi
  sleep 1
  if [[ "$i" -eq 50 ]]; then
    echo "FAIL: API not ready — tail .backend.log" >&2
    tail -40 "${ROOT}/.backend.log" >&2 || true
    exit 1
  fi
done

if [[ "${SKIP_FRONTEND:-0}" != "1" ]]; then
  if ! curl -sf -m 2 -o /dev/null "http://127.0.0.1:5173/" 2>/dev/null; then
    if ss -ltn 2>/dev/null | grep -q ':5173 '; then
      echo "WARN: :5173 in use — open existing Vite or stop it" >&2
    else
      [[ -d frontend/node_modules ]] || (cd frontend && npm ci)
      echo "==> Vite dev :5173"
      nohup bash -lc "cd \"${ROOT}/frontend\" && npm run dev -- --host 127.0.0.1 --port 5173" \
        >"${ROOT}/.frontend-dev.log" 2>&1 &
      for j in $(seq 1 30); do
        curl -sf -m 2 -o /dev/null "http://127.0.0.1:5173/" 2>/dev/null && break
        sleep 1
      done
    fi
  else
    echo "==> Vite already up :5173"
  fi
fi

echo "==> Smoke tests"
LOCAL_SKIP_NGINX=1 STACK_VERIFY_SKIP_INFRA=0 "${ROOT}/scripts/verify-stack.sh"

echo ""
echo "Local lab ready."
echo "  UI   http://127.0.0.1:5173/"
echo "  API  http://127.0.0.1:8000/api/v1"
echo "  Login: admin / quantum2026"
echo "  Logs: .backend.log  .frontend-dev.log"
echo "  Re-trim: bash scripts/vm-demo-trim.sh"
echo "  Aggressive trim: LOCAL_TRIM_AGGRESSIVE=1 bash scripts/local-lab-restart.sh"