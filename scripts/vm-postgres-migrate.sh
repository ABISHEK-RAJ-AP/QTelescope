#!/usr/bin/env bash
# VM: Postgres/Timescale for Q-TeleScope — uses existing :5432 if ready, else Docker on :5433+.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SQLITE_URL="${SQLITE_URL:-sqlite:///./data/qtelescope.db}"
PG_USER="${PG_USER:-postgres}"
PG_PASS="${PG_PASS:-postgrespassword}"
PG_DB="${PG_DB:-quantum_telemetry}"
PG_HOST="${PG_HOST:-127.0.0.1}"

port_listening() {
  local port="${1:?}"
  ss -lnt 2>/dev/null | grep -qE ":${port}[[:space:]]"
}

docker_invoke() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  elif sudo docker info >/dev/null 2>&1; then
    sudo docker "$@"
  else
    echo "FAIL: cannot run docker (add user to docker group or use existing Postgres on :5432)" >&2
    return 1
  fi
}

pg_ready() {
  local port="$1"
  command -v pg_isready >/dev/null 2>&1 || return 1
  pg_isready -h "$PG_HOST" -p "$port" -U "$PG_USER" >/dev/null 2>&1
}

ensure_database() {
  local port="$1"
  if ! command -v psql >/dev/null 2>&1; then
  echo "WARN: psql not installed — assuming database ${PG_DB} exists on :${port}" >&2
  return 0
  fi
  export PGPASSWORD="$PG_PASS"
  local exists
  exists="$(psql -h "$PG_HOST" -p "$port" -U "$PG_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" 2>/dev/null || true)"
  if [[ "$exists" != "1" ]]; then
    echo "==> Creating database ${PG_DB} on :${port}"
    psql -h "$PG_HOST" -p "$port" -U "$PG_USER" -d postgres -c "CREATE DATABASE ${PG_DB};"
  fi
}

pick_postgres() {
  # 1) Explicit override
  if [[ -n "${PG_URL:-}" ]]; then
    echo "using env PG_URL"
    return 0
  fi

  # 2) Existing server on 5432 (system Postgres)
  if pg_ready 5432; then
    echo "==> Using existing PostgreSQL on ${PG_HOST}:5432"
    ensure_database 5432
    PG_URL="postgresql+psycopg2://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}"
    export PG_URL
    return 0
  fi

  # 3) Docker Timescale on free port (default 5433)
  if ! command -v docker >/dev/null 2>&1; then
    echo "FAIL: no Postgres on :5432 and Docker not installed" >&2
    exit 1
  fi

  local publish="${TIMESCALE_PUBLISH_PORT:-5433}"
  while port_listening "$publish"; do
    publish=$((publish + 1))
  done
  export TIMESCALE_PUBLISH_PORT="$publish"
  echo "==> Starting TimescaleDB container on host port ${publish} (5432 was busy or unused)"
  docker_invoke compose -f docker-compose.timescale.yml --profile timescale up -d db

  for _ in $(seq 1 45); do
    if docker_invoke exec quantum_timescaledb pg_isready -U postgres -d "$PG_DB" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! docker_invoke exec quantum_timescaledb pg_isready -U postgres -d "$PG_DB" >/dev/null 2>&1; then
    echo "FAIL: Timescale container did not become ready" >&2
    docker_invoke logs quantum_timescaledb 2>&1 | tail -30 >&2 || true
    exit 1
  fi

  PG_URL="postgresql+psycopg2://${PG_USER}:${PG_PASS}@${PG_HOST}:${publish}/${PG_DB}"
  export PG_URL
}

pick_postgres

export DATABASE_URL="$PG_URL"
export USE_ALEMBIC=true
export PYTHONPATH="$ROOT"

activate() {
  if [[ -f "${ROOT}/.venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "${ROOT}/.venv/bin/activate"
  elif [[ -x "${HOME}/miniforge3/bin/python" ]]; then
    export PATH="${HOME}/miniforge3/bin:$PATH"
  fi
}
activate

if ! python -c "import psycopg2" 2>/dev/null; then
  echo "==> Installing psycopg2-binary"
  pip install -q psycopg2-binary
fi

echo "==> DATABASE_URL=${DATABASE_URL}"
echo "==> Alembic upgrade"
python -m alembic upgrade head

echo "==> SQLite → Postgres data copy (SQLite file unchanged)"
python scripts/migrate_sqlite_to_postgres.py --sqlite "$SQLITE_URL" --postgres "$PG_URL"

echo "==> Timescale hypertables (optional)"
python scripts/init_timescale_hypertables.py || echo "WARN: hypertable step skipped (plain Postgres or no extension)"

ENVF="${ROOT}/.env"
touch "$ENVF"
if grep -q '^DATABASE_URL=' "$ENVF"; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${PG_URL}|" "$ENVF"
else
  printf 'DATABASE_URL=%s\n' "$PG_URL" >>"$ENVF"
fi
grep -q '^USE_ALEMBIC=' "$ENVF" && sed -i 's|^USE_ALEMBIC=.*|USE_ALEMBIC=true|' "$ENVF" || echo 'USE_ALEMBIC=true' >>"$ENVF"
grep -q '^STARTUP_HARDWARE_DISCOVERY=' "$ENVF" || echo 'STARTUP_HARDWARE_DISCOVERY=auto' >>"$ENVF"

echo ""
echo "==> Migration complete"
echo "    1) ./scripts/vm-demo-restart.sh"
echo "    2) ./scripts/performance-smoke.sh"
echo "    3) curl -s http://127.0.0.1:8000/api/v1/admin/deployment/profile | python3 -m json.tool | grep -i database"