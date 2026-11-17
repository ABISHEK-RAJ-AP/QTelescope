#!/usr/bin/env bash
# Ensure Redis or Valkey is running and .env has REDIS_URL + CACHE_ENABLED.
# Source from vm-update / vm-demo-restart:  source scripts/vm-ensure-redis-cache.sh
# Standalone: ./scripts/vm-ensure-redis-cache.sh [repo-root]
set -euo pipefail

ensure_redis_cache() {
  local ROOT="${1:?repo root}"
  local envf="${ROOT}/.env"
  local REDIS_DIR="${REDIS_DIR:-$ROOT/.redis-data}"
  local port="${REDIS_PORT:-6379}"
  local url="redis://127.0.0.1:${port}/0"

  upsert_env() {
    local key="$1" val="$2"
    touch "$envf"
    if grep -qE "^${key}=" "$envf"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
    else
      printf '%s=%s\n' "$key" "$val" >>"$envf"
    fi
  }

  ping_redis() {
    if command -v redis-cli >/dev/null 2>&1; then
      redis-cli -p "$port" ping >/dev/null 2>&1 && return 0
    fi
    if command -v valkey-cli >/dev/null 2>&1; then
      valkey-cli -p "$port" ping >/dev/null 2>&1 && return 0
    fi
    return 1
  }

  start_user_redis() {
    mkdir -p "$REDIS_DIR"
    if command -v redis-server >/dev/null 2>&1; then
      redis-server --daemonize yes --port "$port" --dir "$REDIS_DIR" --logfile "$REDIS_DIR/redis.log" 2>/dev/null || true
      sleep 1
      ping_redis && return 0
    fi
    if command -v valkey-server >/dev/null 2>&1; then
      valkey-server --daemonize yes --port "$port" --dir "$REDIS_DIR" --logfile "$REDIS_DIR/valkey.log" 2>/dev/null || true
      sleep 1
      ping_redis && return 0
    fi
    return 1
  }

  install_redis_conda() {
    local MAMBA="${MAMBA:-${HOME}/miniforge3/bin/mamba}"
    if [[ ! -x "$MAMBA" ]]; then
      return 1
    fi
    export PATH="${HOME}/miniforge3/bin:${PATH:-}"
    echo "==> installing redis-server via conda-forge (user space)"
    "$MAMBA" install -y -c conda-forge redis >/dev/null 2>&1 || "$MAMBA" install -y -c conda-forge redis-server >/dev/null 2>&1 || true
    command -v redis-server >/dev/null 2>&1
  }

  start_system_redis() {
    if command -v systemctl >/dev/null 2>&1; then
      if systemctl is-active redis-server >/dev/null 2>&1 || systemctl is-active valkey-server >/dev/null 2>&1; then
        return 0
      fi
      if sudo -n systemctl start redis-server 2>/dev/null; then
        sleep 1
        ping_redis && return 0
      fi
      if sudo -n systemctl start valkey-server 2>/dev/null; then
        sleep 1
        ping_redis && return 0
      fi
    fi
    if command -v apt-get >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1; then
      if ! command -v redis-server >/dev/null 2>&1; then
        echo "==> apt install redis-server (sudo)"
        sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server >/dev/null 2>&1 || true
      fi
      sudo systemctl enable redis-server 2>/dev/null || true
      sudo systemctl start redis-server 2>/dev/null || true
      sleep 1
      ping_redis && return 0
    fi
    return 1
  }

  if ping_redis; then
    echo "Redis OK on port ${port}"
  elif start_user_redis; then
    echo "Redis started (user daemon, ${REDIS_DIR})"
  elif install_redis_conda && start_user_redis; then
    echo "Redis installed via conda and started"
  elif start_system_redis; then
    echo "Redis started via system service"
  else
    echo "WARN: Redis not reachable — API will use in-process cache fallback only" >&2
    upsert_env CACHE_ENABLED true
    upsert_env REDIS_URL ""
    return 0
  fi

  upsert_env REDIS_URL "$url"
  upsert_env CACHE_ENABLED true
  echo ".env: REDIS_URL=${url} CACHE_ENABLED=true"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  ensure_redis_cache "$ROOT"
fi