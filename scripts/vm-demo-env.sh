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
  # Hybrid demo: Rigetti QCS ISA on a timer; IBM/IonQ/C-DAC stay simulated.
  upsert_env HYBRID_DEMO_ENABLED true
  upsert_env DEMO_LIVE_PROVIDERS rigetti_quantum
  upsert_env COLLECTION_SCHEDULER_ENABLED true
  upsert_env RIGETTI_ISA_CACHE_SECONDS 45
  upsert_env ALLOW_PUBLIC_REGISTRATION true
  if [[ -f "${ROOT}/scripts/vm-ensure-redis-cache.sh" ]]; then
    # shellcheck source=scripts/vm-ensure-redis-cache.sh
    source "${ROOT}/scripts/vm-ensure-redis-cache.sh"
    ensure_redis_cache "$ROOT"
  else
    upsert_env CACHE_ENABLED true
    upsert_env REDIS_URL ""
  fi
  # Keep Bearer sessions across uvicorn restarts (demo/lab). Without this, overview 401s after restart.
  upsert_env PERSIST_API_SESSIONS true
  upsert_env ADMIN_USERNAME admin
  upsert_env ADMIN_PASSWORD quantum2026
  upsert_env USER_USERNAME user_researcher
  upsert_env USER_PASSWORD quantum2026
  upsert_env SUPERADMIN_USERNAME superadmin
  upsert_env SUPERADMIN_PASSWORD quantum2026
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
  if [[ -f "${ROOT}/.venv/bin/activate" ]]; then
    # shellcheck disable=SC1091
    source "${ROOT}/.venv/bin/activate"
  elif [[ -f "${ROOT}/venv/bin/activate" ]]; then
    # shellcheck disable=SC1091
    source "${ROOT}/venv/bin/activate"
  elif [[ -x "${HOME}/miniforge3/bin/python" ]]; then
    export PATH="${HOME}/miniforge3/bin:${PATH}"
    echo "WARN: no venv activate — using ${HOME}/miniforge3/bin/python" >&2
  else
    echo "WARN: no venv — using $(command -v python || echo 'python-not-found')" >&2
  fi
}

free_lab_port() {
  local port="${1:-4173}"
  pkill -f 'vite preview' 2>/dev/null || true
  local line pid name
  while IFS= read -r line; do
    pid="$(echo "$line" | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -1)"
    [[ -z "$pid" ]] && continue
    name="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
    case "$name" in
      node|node-vite|MainThread) sudo kill "$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true ;;
      nginx) ;;
      *) ;;
    esac
  done < <(ss -lntp 2>/dev/null | grep -E ":${port}[[:space:]]" || true)
  sleep 1
}

port_is_listening() {
  local port="${1:?}"
  ss -lnt 2>/dev/null | grep -qE ":${port}[[:space:]]"
}

# Nginx serves plain ok — Vite preview does not.
nginx_ui_ok() {
  local port="${1:-4173}"
  curl -sf -m 5 "http://127.0.0.1:${port}/healthz" 2>/dev/null | grep -qx 'ok'
}

ensure_nginx_ui_port() {
  local port="${1:-4173}"
  local try
  for try in 1 2 3; do
    free_lab_port "$port"
    if port_is_listening "$port" && ! nginx_ui_ok "$port"; then
      echo "==> :${port} held by non-nginx process — freeing (try ${try})" >&2
      sudo fuser -k "${port}/tcp" 2>/dev/null || true
      sleep 2
    fi
    if ! port_is_listening "$port"; then
      return 0
    fi
    if nginx_ui_ok "$port"; then
      return 0
    fi
  done
  echo "FAIL: :${port} not serving Q-TeleScope nginx (healthz)" >&2
  ss -lntp 2>/dev/null | grep -E ":${port}[[:space:]]" || ss -lnt 2>/dev/null | grep -E ":${port}[[:space:]]" || true
  return 1
}

qtelescope_api_ok() {
  local base="${1:-http://127.0.0.1:8000}"
  curl -sf -m 8 "${base}/api/v1/auth/config-status" 2>/dev/null | grep -q '"enable_mock_data"'
}

verify_api_direct() {
  local url="${1:-http://127.0.0.1:8000/api/v1/auth/config-status}"
  if qtelescope_api_ok "http://127.0.0.1:8000"; then
    return 0
  fi
  echo "FAIL: Q-TeleScope API not healthy at $url (wrong app on :8000 or stale uvicorn?)" >&2
  ss -lntp 2>/dev/null | grep -E ':8000[[:space:]]' || true
  return 1
}

stop_foreign_api_port() {
  local port="${1:-8000}"
  if qtelescope_api_ok "http://127.0.0.1:${port}"; then
    return 0
  fi
  if ! ss -lntp 2>/dev/null | grep -qE ":${port}[[:space:]]"; then
    return 0
  fi
  echo "==> Port ${port} in use but not Q-TeleScope (e.g. old QRP) — stopping uvicorn listeners"
  pkill -f "uvicorn.*--port[ =]${port}" 2>/dev/null || true
  pkill -f "uvicorn.*:${port}" 2>/dev/null || true
  pkill -f 'uvicorn app.main:app' 2>/dev/null || true
  sleep 2
  if ss -lntp 2>/dev/null | grep -qE ":${port}[[:space:]]" && ! qtelescope_api_ok "http://127.0.0.1:${port}"; then
    echo "WARN: port ${port} still busy after uvicorn stop; trying fuser" >&2
    sudo fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 2
  fi
}

verify_nginx_api_proxy() {
  local port="${1:-4173}"
  local url="http://127.0.0.1:${port}/api/v1/auth/config-status"
  local code body
  code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  if [[ "$code" == "200" ]] && curl -sf -m 8 "$url" | grep -q '"enable_mock_data"'; then
    return 0
  fi
  echo "FAIL: nginx on :${port} did not proxy Q-TeleScope /api/v1 (HTTP ${code} from $url)" >&2
  local direct
  direct="$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/api/v1/auth/config-status 2>/dev/null || echo 000)"
  echo "    Direct :8000 auth/config-status → HTTP ${direct}" >&2
  ss -lntp 2>/dev/null | grep -E ":${port}[[:space:]]" || true
  if command -v nginx >/dev/null 2>&1; then
    sudo grep -E 'location|proxy_pass|listen' /etc/nginx/sites-enabled/qtelescope 2>/dev/null | head -20 >&2 || true
  fi
  return 1
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
  stop_foreign_api_port 8000
  pkill -f 'uvicorn app.main:app' 2>/dev/null || true
  sleep 1
  export PYTHONPATH="${ROOT}"
  load_env_file "${ROOT}/.env"
  activate_python_venv "$ROOT"
  mkdir -p "${ROOT}/data"
  nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$log" 2>&1 &
  echo "API log: $log"
  wait_for_api "http://127.0.0.1:8000/api/v1/auth/config-status" "$log" || return 1
  qtelescope_api_ok "http://127.0.0.1:8000" || {
    echo "FAIL: uvicorn on :8000 is not Q-TeleScope (check .backend.log)" >&2
    tail -30 "$log" >&2 || true
    return 1
  }
}
