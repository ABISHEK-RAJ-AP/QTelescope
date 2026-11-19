#!/usr/bin/env bash
# Age-only delete. For demo VMs prefer ./scripts/vm-demo-trim.sh (age + per-backend cap).
# Delete telemetry older than TELEMETRY_RETENTION_DAYS (default 60).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
load_env_file "${ROOT}/.env"
export PYTHONPATH="$ROOT"

: "${TELEMETRY_RETENTION_DAYS:=60}"
export TELEMETRY_RETENTION_DAYS

activate_python_venv "$ROOT" 2>/dev/null || true
if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi

if [[ "${DATABASE_URL:-}" != postgresql* ]]; then
  echo "DATABASE_URL is not PostgreSQL — trim still works on SQLite but VM should use Postgres" >&2
fi

echo "==> Telemetry retention (keep ${TELEMETRY_RETENTION_DAYS} days)"
python3 <<'PY'
from app.core.database import SessionLocal
from app.jobs.telemetry_retention import run_telemetry_retention, retention_policy

with SessionLocal() as db:
    deleted = run_telemetry_retention(db)
    print("deleted_rows:", deleted)
    print("policy:", retention_policy())
PY

echo "==> Re-ANALYZE (optional)"
if [[ -x "${ROOT}/scripts/vm-db-optimize.sh" ]] && [[ "${DATABASE_URL:-}" == postgresql* ]]; then
  "${ROOT}/scripts/vm-db-optimize.sh" || true
fi