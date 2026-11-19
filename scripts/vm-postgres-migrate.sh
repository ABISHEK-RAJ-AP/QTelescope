#!/usr/bin/env bash
# VM: auto Postgres/Timescale for Q-TeleScope (SQLite → Postgres data copy).
# - Verifies password auth (pg_isready alone is not enough).
# - Tries .env DATABASE_URL, PG_PASS/PGPASSWORD, common lab passwords.
# - On Ubuntu: sudo -u postgres peer to create DB + set known lab password (opt-out: QTELESCOPE_PG_AUTO_SETUP=0).
# - Fallback: Timescale Docker on :5433+ with postgrespassword.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SQLITE_URL="${SQLITE_URL:-sqlite:///./data/qtelescope.db}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-quantum_telemetry}"
PG_HOST="${PG_HOST:-127.0.0.1}"
LAB_PASSWORD="${QTELESCOPE_DB_PASSWORD:-${PG_PASS:-${PGPASSWORD:-postgrespassword}}}"
AUTO_SETUP="${QTELESCOPE_PG_AUTO_SETUP:-1}"
PREFER_DOCKER="${TIMESCALE_PREFER_DOCKER:-0}"

port_listening() {
  local port="${1:?}"
  ss -lnt 2>/dev/null | grep -qE ":${port}[[:space:]]"
}

docker_invoke() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  elif sudo -E docker info >/dev/null 2>&1; then
    sudo -E docker "$@"
  else
    return 1
  fi
}

compose_timescale() {
  local publish="$1"
  shift
  local override="${ROOT}/.timescale-publish.override.yml"
  cat >"$override" <<EOF
services:
  db:
    ports:
      - "${publish}:5432"
EOF
  export TIMESCALE_PUBLISH_PORT="$publish"
  if docker info >/dev/null 2>&1; then
    docker compose -f docker-compose.timescale.yml -f "$override" --profile timescale "$@"
  else
    sudo env TIMESCALE_PUBLISH_PORT="$publish" \
      docker compose -f docker-compose.timescale.yml -f "$override" --profile timescale "$@"
  fi
}

pg_is_up() {
  local port="$1"
  command -v pg_isready >/dev/null 2>&1 || port_listening "$port"
  pg_isready -h "$PG_HOST" -p "$port" -U "$PG_USER" >/dev/null 2>&1 || port_listening "$port"
}

parse_env_database_url() {
  local envf="${ROOT}/.env"
  [[ -f "$envf" ]] || return 0
  local line
  line="$(grep -m1 '^DATABASE_URL=' "$envf" 2>/dev/null | cut -d= -f2- || true)"
  [[ "$line" == postgresql* ]] || return 0
  PG_URL="$line"
  export PG_URL
}

password_from_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse, unquote
u = urlparse(sys.argv[1].replace("+psycopg2", "", 1))
if u.password:
    print(unquote(u.password))
PY
}

try_psql() {
  local port="$1" pass="$2"
  export PGPASSWORD="$pass"
  psql -h "$PG_HOST" -p "$port" -U "$PG_USER" -d postgres -tAc "SELECT 1" >/dev/null 2>&1
}

try_python_pg() {
  local url="$1"
  TEST_PG_URL="$url" PYTHONPATH="$ROOT" python3 <<'PY'
import os, sys
url = os.environ["TEST_PG_URL"]
try:
    import psycopg2
    from urllib.parse import urlparse, unquote
    u = urlparse(url.replace("+psycopg2", "", 1))
    conn = psycopg2.connect(
        host=u.hostname or "127.0.0.1",
        port=u.port or 5432,
        user=u.username or "postgres",
        password=unquote(u.password or ""),
        dbname=(u.path or "/postgres").lstrip("/") or "postgres",
        connect_timeout=5,
    )
    conn.close()
    sys.exit(0)
except Exception as e:
    print(str(e)[:120], file=sys.stderr)
    sys.exit(1)
PY
}

discover_password() {
  local port="$1"
  local -a candidates=()
  [[ -n "${PG_PASS:-}" ]] && candidates+=("$PG_PASS")
  [[ -n "${PGPASSWORD:-}" ]] && candidates+=("$PGPASSWORD")
  candidates+=("$LAB_PASSWORD" "root" "postgrespassword" "postgres")
  if [[ -n "${PG_URL:-}" ]]; then
    local p
    p="$(password_from_url "$PG_URL" 2>/dev/null || true)"
    [[ -n "$p" ]] && candidates+=("$p")
  fi
  local c
  for c in "${candidates[@]}"; do
    [[ -z "$c" ]] && continue
    if try_psql "$port" "$c"; then
      PG_PASS="$c"
      export PG_PASS PGPASSWORD="$c"
      return 0
    fi
  done
  return 1
}

peer_auto_setup() {
  local port="$1"
  [[ "$AUTO_SETUP" == "1" ]] || return 1
  if ! sudo -u postgres psql -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
    return 1
  fi
  echo "==> Auto-setup via sudo -u postgres (sets postgres role password for lab use)"
  sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '${LAB_PASSWORD}';"
  if ! sudo -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
    sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${PG_DB};"
  fi
  PG_PASS="$LAB_PASSWORD"
  export PGPASSWORD="$PG_PASS"
  try_psql "$port" "$PG_PASS"
}

ensure_database() {
  local port="$1"
  if ! command -v psql >/dev/null 2>&1; then
    echo "WARN: psql missing — install postgresql-client" >&2
    return 0
  fi
  export PGPASSWORD="${PG_PASS}"
  local exists
  exists="$(psql -h "$PG_HOST" -p "$port" -U "$PG_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" 2>/dev/null || true)"
  if [[ "$exists" != "1" ]]; then
    echo "==> Creating database ${PG_DB}"
    psql -h "$PG_HOST" -p "$port" -U "$PG_USER" -d postgres -c "CREATE DATABASE ${PG_DB};"
  fi
}

docker_timescale_publish_port() {
  docker_invoke port quantum_timescaledb 5432/tcp 2>/dev/null | awk -F: '{print $NF}' | head -1
}

reuse_running_timescale() {
  if ! docker_invoke ps --format '{{.Names}}' 2>/dev/null | grep -qx quantum_timescaledb; then
    return 1
  fi
  local pub
  pub="$(docker_timescale_publish_port)"
  [[ -n "$pub" ]] || return 1
  if ! docker_invoke exec quantum_timescaledb pg_isready -U postgres -d "$PG_DB" >/dev/null 2>&1; then
    return 1
  fi
  echo "==> Reusing running TimescaleDB container on host port ${pub}"
  PG_PASS="$LAB_PASSWORD"
  PG_URL="postgresql+psycopg2://${PG_USER}:${PG_PASS}@${PG_HOST}:${pub}/${PG_DB}"
  export PG_URL PG_PASS PGPASSWORD="$PG_PASS"
  return 0
}

start_docker_timescale() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "FAIL: Docker not installed" >&2
    return 1
  fi
  if ! docker_invoke info >/dev/null 2>&1; then
    echo "FAIL: Docker not accessible (try: sudo usermod -aG docker \$USER && re-login)" >&2
    return 1
  fi
  if reuse_running_timescale; then
    return 0
  fi
  echo "==> Removing stale quantum_timescaledb container (if any)"
  docker_invoke rm -f quantum_timescaledb 2>/dev/null || true
  compose_timescale 5433 down 2>/dev/null || true
  local publish="${TIMESCALE_PUBLISH_PORT:-5433}"
  while port_listening "$publish"; do
    publish=$((publish + 1))
  done
  export TIMESCALE_PUBLISH_PORT="$publish"
  echo "==> TimescaleDB Docker on host port ${publish} (password: ${LAB_PASSWORD})"
  compose_timescale "$publish" up -d db
  for _ in $(seq 1 60); do
    if docker_invoke exec quantum_timescaledb pg_isready -U postgres -d "$PG_DB" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker_invoke exec quantum_timescaledb pg_isready -U postgres -d "$PG_DB" >/dev/null 2>&1 || {
    docker_invoke logs quantum_timescaledb 2>&1 | tail -25 >&2
    return 1
  }
  PG_PASS="$LAB_PASSWORD"
  PG_URL="postgresql+psycopg2://${PG_USER}:${PG_PASS}@${PG_HOST}:${publish}/${PG_DB}"
  export PG_URL PG_PASS PGPASSWORD="$PG_PASS"
}

pick_postgres() {
  if [[ -n "${PG_URL:-}" ]]; then
    if try_python_pg "$PG_URL"; then
      echo "==> Using PG_URL from environment"
      return 0
    fi
    echo "WARN: PG_URL set but connection failed — continuing auto-detect" >&2
    unset PG_URL
  fi

  parse_env_database_url
  if [[ -n "${PG_URL:-}" ]]; then
    if try_python_pg "$PG_URL"; then
      echo "==> Using DATABASE_URL from .env"
      return 0
    fi
    unset PG_URL
  fi

  if [[ "$PREFER_DOCKER" == "1" ]]; then
    start_docker_timescale
    return 0
  fi

  if pg_is_up 5432; then
    if discover_password 5432; then
      echo "==> Using PostgreSQL on ${PG_HOST}:5432 (password auth OK)"
      ensure_database 5432
      PG_URL="postgresql+psycopg2://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}"
      export PG_URL
      return 0
    fi
    if peer_auto_setup 5432; then
      echo "==> Using PostgreSQL on ${PG_HOST}:5432 after peer auto-setup"
      ensure_database 5432
      PG_URL="postgresql+psycopg2://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}"
      export PG_URL
      return 0
    fi
    echo "WARN: :5432 is up but password auth failed — using Docker Timescale instead" >&2
  fi

  start_docker_timescale
}

install_prereqs() {
  if ! command -v psql >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      echo "==> Installing postgresql-client"
      sudo apt-get update -qq
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client
    fi
  fi
}

install_prereqs
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

echo "==> SQLite → Postgres (SQLite file untouched)"
python scripts/migrate_sqlite_to_postgres.py --sqlite "$SQLITE_URL" --postgres "$PG_URL"

echo "==> Timescale hypertables (optional)"
python scripts/init_timescale_hypertables.py || echo "WARN: hypertables skipped (plain Postgres OK)"

ENVF="${ROOT}/.env"
touch "$ENVF"
if grep -q '^DATABASE_URL=' "$ENVF"; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${PG_URL}|" "$ENVF"
else
  printf 'DATABASE_URL=%s\n' "$PG_URL" >>"$ENVF"
fi
grep -q '^USE_ALEMBIC=' "$ENVF" && sed -i 's|^USE_ALEMBIC=.*|USE_ALEMBIC=true|' "$ENVF" || echo 'USE_ALEMBIC=true' >>"$ENVF"
grep -q '^STARTUP_HARDWARE_DISCOVERY=' "$ENVF" || echo 'STARTUP_HARDWARE_DISCOVERY=auto' >>"$ENVF"
grep -q '^QTELESCOPE_KEEP_DATABASE_URL=' "$ENVF" || echo 'QTELESCOPE_KEEP_DATABASE_URL=true' >>"$ENVF"

echo ""
echo "==> Done"
echo "    ./scripts/vm-demo-restart.sh"
echo "    ./scripts/performance-smoke.sh"