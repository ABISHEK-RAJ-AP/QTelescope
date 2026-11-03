#!/usr/bin/env bash
# One-time: Miniforge Postgres (superuser postgres / password root) + Redis.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAMBA="${MAMBA:-/home/boss/miniforge3/bin/mamba}"
export PATH="/home/boss/miniforge3/bin:${PATH:-}"

if [[ ! -x "$MAMBA" ]]; then
  echo "Install Miniforge to /home/boss/miniforge3 first." >&2
  exit 1
fi

"$MAMBA" install -y -c conda-forge postgresql=16 python=3.11 pip redis-server
"$MAMBA" run -n base pip install -q psycopg2-binary redis

PGDATA="${PGDATA:-$ROOT/.pgdata}"
PW="${POSTGRES_PASSWORD:-root}"
mkdir -p "$PGDATA"
if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  PWFILE="$(mktemp)"
  chmod 600 "$PWFILE"
  printf '%s\n' "$PW" >"$PWFILE"
  initdb -D "$PGDATA" -U postgres --encoding=UTF8 --locale=C -A scram-sha-256 --pwfile="$PWFILE"
  rm -f "$PWFILE"
fi

pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" -o "-p 5432" start
sleep 2
export PGPASSWORD="$PW"
psql -h localhost -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='quantum_telemetry'" | grep -q 1 \
  || createdb -h localhost -U postgres quantum_telemetry

REDIS_DIR="${REDIS_DIR:-$ROOT/.redis-data}"
mkdir -p "$REDIS_DIR"
redis-server --daemonize yes --port 6379 --dir "$REDIS_DIR" --logfile "$REDIS_DIR/redis.log" || true

echo "Done. Copy backend/.env.example to .env and set:"
echo "  DATABASE_URL=postgresql+psycopg2://postgres:${PW}@localhost:5432/quantum_telemetry"
echo "  REDIS_URL=redis://localhost:6379/0"
