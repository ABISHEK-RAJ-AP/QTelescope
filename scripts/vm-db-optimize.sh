#!/usr/bin/env bash
# Post-migrate Postgres tune: Alembic indexes + ANALYZE (no Timescale required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"
load_env_file "${ROOT}/.env"
export PYTHONPATH="$ROOT"

if [[ "${DATABASE_URL:-}" != postgresql* ]]; then
  echo "DATABASE_URL is not PostgreSQL — run ./scripts/vm-pin-postgres-env.sh first" >&2
  exit 1
fi

activate_python_venv "$ROOT" 2>/dev/null || true
if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi

echo "==> Alembic upgrade (indexes)"
python -m alembic upgrade head

echo "==> ANALYZE telemetry tables"
python3 <<'PY'
import os
from sqlalchemy import create_engine, text

url = os.environ["DATABASE_URL"]
engine = create_engine(url)
tables = (
    "gate_telemetry",
    "qubit_telemetry",
    "backend_telemetry",
    "calibration_snapshots",
    "alerts",
    "backends",
    "job_records",
)
with engine.connect() as conn:
    for t in tables:
        try:
            conn.execute(text(f'ANALYZE "{t}"'))
            print(f"  ANALYZE {t}")
        except Exception as exc:
            print(f"  skip {t}: {exc}")
    conn.commit()
print("done")
PY

echo "==> Optional: Timescale in Docker (hypertables only — not required for speed)"
echo "    TIMESCALE_PREFER_DOCKER=1 ./scripts/vm-postgres-migrate.sh  # new DB on :5434+"
echo "==> Optional: trim old telemetry: TELEMETRY_RETENTION_DAYS=60 ./scripts/vm-telemetry-trim.sh"