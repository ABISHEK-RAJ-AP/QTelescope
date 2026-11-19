#!/usr/bin/env bash
# One command: deps + SQLite→Postgres + .env + optional frontend build hint.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x scripts/vm-postgres-migrate.sh scripts/vm-demo-restart.sh 2>/dev/null || true
export QTELESCOPE_PG_AUTO_SETUP="${QTELESCOPE_PG_AUTO_SETUP:-1}"
export QTELESCOPE_DB_PASSWORD="${QTELESCOPE_DB_PASSWORD:-postgrespassword}"
"${ROOT}/scripts/vm-postgres-migrate.sh"
echo ""
echo "==> Restarting demo stack"
"${ROOT}/scripts/vm-demo-restart.sh"
if [[ -d "${ROOT}/frontend/node_modules" ]]; then
  (cd "${ROOT}/frontend" && npm run build) || echo "WARN: frontend build failed — run: cd frontend && npm ci && npm run build"
fi