#!/usr/bin/env bash
# Pin .env to PostgreSQL after migrate (system :5432 or Docker port from argument).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-5432}"
PASS="${QTELESCOPE_DB_PASSWORD:-postgrespassword}"
ENVF="${ROOT}/.env"
URL="postgresql+psycopg2://postgres:${PASS}@127.0.0.1:${PORT}/quantum_telemetry"
touch "$ENVF"
if grep -q '^DATABASE_URL=' "$ENVF"; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${URL}|" "$ENVF"
else
  printf 'DATABASE_URL=%s\n' "$URL" >>"$ENVF"
fi
grep -q '^USE_ALEMBIC=' "$ENVF" && sed -i 's|^USE_ALEMBIC=.*|USE_ALEMBIC=true|' "$ENVF" || echo 'USE_ALEMBIC=true' >>"$ENVF"
grep -q '^QTELESCOPE_KEEP_DATABASE_URL=' "$ENVF" || echo 'QTELESCOPE_KEEP_DATABASE_URL=true' >>"$ENVF"
echo "Pinned DATABASE_URL → 127.0.0.1:${PORT}/quantum_telemetry"