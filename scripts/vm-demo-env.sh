# shellcheck shell=bash
# Demo .env keys — source from vm-update / vm-demo-restart (do not execute alone).
apply_vm_demo_env() {
  local ROOT="${1:?repo root}"
  local envf="${ROOT}/.env"

  upsert_env() {
    local key="$1" val="$2"
    touch "$envf"
    if grep -qE "^${key}=" "$envf"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
    else
      printf '%s=%s\n' "$key" "$val" >> "$envf"
    fi
  }

  ensure_secret_key() {
    touch "$envf"
    local sk=""
    sk=$(grep -m1 '^SECRET_KEY=' "$envf" 2>/dev/null | cut -d= -f2- || true)
    if [[ -z "$sk" || "$sk" == *'<'* || "$sk" == *'`'* || ${#sk} -lt 32 ]]; then
      sk=$(openssl rand -hex 32)
      upsert_env SECRET_KEY "$sk"
      echo "SECRET_KEY reset (invalid or short — generate with: openssl rand -hex 32)"
    fi
  }

  ensure_sqlite_if_no_postgres() {
    local db=""
    db=$(grep -m1 '^DATABASE_URL=' "$envf" 2>/dev/null | cut -d= -f2- || true)
    if [[ "$db" == postgresql* ]] && ! command -v pg_isready >/dev/null 2>&1; then
      upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
      upsert_env USE_ALEMBIC "true"
      echo "DATABASE_URL → sqlite (pg_isready not on PATH)"
    elif [[ "$db" == postgresql* ]] && ! pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
      upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
      echo "DATABASE_URL → sqlite (PostgreSQL not running)"
    elif [[ -z "$db" ]]; then
      upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
    fi
  }

  ensure_secret_key
  ensure_sqlite_if_no_postgres
  upsert_env ENABLE_MOCK_DATA true
  upsert_env BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS false
  upsert_env CACHE_ENABLED false
  upsert_env REDIS_URL ""
  upsert_env ADMIN_USERNAME admin
  upsert_env ADMIN_PASSWORD quantum2026
  upsert_env USER_USERNAME user_researcher
  upsert_env USER_PASSWORD quantum2026
}

load_env_file() {
  local envf="${1:?}"
  [[ -f "$envf" ]] || return 0
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    [[ "$line" == *'<'* || "$line" == *'`'* ]] && continue
    export "$line"
  done < "$envf"
  set +a
}

activate_python_venv() {
  local ROOT="${1:?}"
  if [[ -d "${ROOT}/.venv" ]]; then
    # shellcheck disable=SC1091
    source "${ROOT}/.venv/bin/activate"
  elif [[ -d "${ROOT}/venv" ]]; then
    # shellcheck disable=SC1091
    source "${ROOT}/venv/bin/activate"
  else
    echo "WARN: no venv — using $(command -v python)" >&2
  fi
}

wait_for_api() {
  local url="${1:-http://127.0.0.1:8000/api/v1/auth/captcha}"
  local log="${2:-}"
  local i
  for i in $(seq 1 30); do
    if curl -sf -m 3 -o /dev/null "$url" 2>/dev/null; then
      echo "API ready (${i}s)"
      return 0
    fi
    sleep 1
  done
  echo "FAIL: API not up after 30s — ${url}" >&2
  if [[ -n "$log" && -f "$log" ]]; then
    echo "--- tail ${log} ---" >&2
    tail -40 "$log" >&2
  fi
  return 1
}

restart_uvicorn() {
  local ROOT="${1:?}"
  local log="${ROOT}/.backend.log"
  pkill -f 'uvicorn app.main:app' 2>/dev/null || true
  sleep 1
  export PYTHONPATH="${ROOT}"
  load_env_file "${ROOT}/.env"
  activate_python_venv "$ROOT"
  mkdir -p "${ROOT}/data"
  nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$log" 2>&1 &
  echo "API log: $log"
  wait_for_api "http://127.0.0.1:8000/api/v1/auth/captcha" "$log" || return 1
}
