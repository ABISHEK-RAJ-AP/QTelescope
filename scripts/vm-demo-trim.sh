#!/usr/bin/env bash
# Shrink telemetry for demo day: drop old rows + cap per-backend history (see app/jobs/demo_telemetry_trim.py).
# Typical: 3M+ rows → ~20k–80k — enough for health, compare, live telemetry, no long loads.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
load_env_file "${ROOT}/.env"
export PYTHONPATH="$ROOT"

# Aggressive demo defaults (override for stricter diet)
: "${DEMO_RETENTION_DAYS:=14}"
: "${DEMO_TELEMETRY_CAP_PER_BACKEND:=2500}"
: "${DEMO_BACKEND_TELEMETRY_CAP:=400}"
export DEMO_RETENTION_DAYS DEMO_TELEMETRY_CAP_PER_BACKEND DEMO_BACKEND_TELEMETRY_CAP

activate_python_venv "$ROOT" 2>/dev/null || true
if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi

echo "==> Demo telemetry diet (keep ${DEMO_RETENTION_DAYS}d, cap ${DEMO_TELEMETRY_CAP_PER_BACKEND}/backend)"
python3 <<'PY'
import json
from app.core.database import SessionLocal
from app.jobs.demo_telemetry_trim import format_trim_report, run_demo_telemetry_trim

with SessionLocal() as db:
    report = run_demo_telemetry_trim(db)
for line in format_trim_report(report):
    print(line)
print("detail:", json.dumps(report, default=str))
PY

echo "==> ANALYZE + optional VACUUM (Postgres)"
if [[ "${DATABASE_URL:-}" == postgresql* ]]; then
  if [[ -x "${ROOT}/scripts/vm-db-optimize.sh" ]]; then
    "${ROOT}/scripts/vm-db-optimize.sh"
  fi
else
  echo "SQLite: consider backup then restart API after trim"
fi

echo ""
echo "Tip: pin ongoing retention in .env for the demo VM:"
echo "  TELEMETRY_RETENTION_DAYS=${DEMO_RETENTION_DAYS}"
echo "  TELEMETRY_RETENTION_ON_STARTUP=true"
echo "Then: ./scripts/vm-demo-restart.sh"