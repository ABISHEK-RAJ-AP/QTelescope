#!/usr/bin/env bash
# VM: start TimescaleDB (Docker), migrate schema, copy SQLite data, enable hypertables.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SQLITE_URL="${SQLITE_URL:-sqlite:///./data/qtelescope.db}"
PG_URL="${PG_URL:-postgresql+psycopg2://postgres:postgrespassword@127.0.0.1:5432/quantum_telemetry}"

echo "==> TimescaleDB container"
if command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.timescale.yml --profile timescale up -d db
  for i in $(seq 1 30); do
    if docker exec quantum_timescaledb pg_isready -U postgres -d quantum_telemetry >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Docker not found — assume Postgres is already running at ${PG_URL}" >&2
fi

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

echo "==> Alembic upgrade"
python -m alembic upgrade head

echo "==> SQLite → Postgres data copy (source untouched)"
python scripts/migrate_sqlite_to_postgres.py --sqlite "$SQLITE_URL" --postgres "$PG_URL"

echo "==> Timescale hypertables (optional)"
python scripts/init_timescale_hypertables.py || echo "WARN: hypertable step skipped (no Timescale extension?)"

ENVF="${ROOT}/.env"
grep -q '^DATABASE_URL=' "$ENVF" && sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${PG_URL}|" "$ENVF" \
  || printf 'DATABASE_URL=%s\n' "$PG_URL" >>"$ENVF"
grep -q '^USE_ALEMBIC=' "$ENVF" && sed -i 's|^USE_ALEMBIC=.*|USE_ALEMBIC=true|' "$ENVF" \
  || echo 'USE_ALEMBIC=true' >>"$ENVF"
grep -q '^STARTUP_HARDWARE_DISCOVERY=' "$ENVF" || echo 'STARTUP_HARDWARE_DISCOVERY=auto' >>"$ENVF"

echo "==> Done. Restart API: ./scripts/vm-demo-restart.sh"
echo "Verify: curl -s http://127.0.0.1:8000/api/v1/admin/deployment/profile | python -m json.tool | grep database"