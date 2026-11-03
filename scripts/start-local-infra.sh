#!/usr/bin/env bash
# User-space Postgres + Redis (Miniforge). No sudo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/home/boss/miniforge3/bin:${PATH:-}"
PGDATA="${PGDATA:-$ROOT/.pgdata}"
REDIS_DIR="${REDIS_DIR:-$ROOT/.redis-data}"
mkdir -p "$REDIS_DIR"

if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  echo "Run setup first: scripts/setup-local-infra.sh" >&2
  exit 1
fi

if ! pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" -o "-p 5432" start
fi

if ! redis-cli ping >/dev/null 2>&1; then
  redis-server --daemonize yes --port 6379 --dir "$REDIS_DIR" --logfile "$REDIS_DIR/redis.log"
fi

echo "PostgreSQL: postgresql://postgres:***@localhost:5432/quantum_telemetry"
echo "Redis: redis://localhost:6379/0"
