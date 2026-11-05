#!/usr/bin/env bash
# VM: install deps, start Postgres/Redis if available, API :8000, QRP UI :5176.
# From repo root:  bash scripts/vm-qrp-setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=/dev/null
source "$ROOT/scripts/lib/ensure-dev-path.sh"

log() { printf '\033[1;36m[vm-qrp]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[vm-qrp]\033[0m %s\n' "$*" >&2; exit 1; }

export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:$HOME/.local/bin:/usr/local/bin:${PATH:-}"
export PYTHONPATH="$ROOT"
export COLLECTION_SCHEDULER_ENABLED="${COLLECTION_SCHEDULER_ENABLED:-false}"

if command -v git >/dev/null 2>&1; then
  log "git pull"
  git pull --ff-only || log "git pull skipped (no tracking remote or conflict)"
fi

[[ -f .env ]] || { cp backend/.env.example .env && log "Wrote .env from backend/.env.example"; }
set -a && source .env && set +a

PY=""
if [[ -x "${MINIFORGE_BIN:-$HOME/miniforge3/bin}/python" ]]; then
  PY="${MINIFORGE_BIN:-$HOME/miniforge3/bin}/python"
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
  PY=python
else
  python3 -m venv .venv
  # shellcheck source=/dev/null
  source .venv/bin/activate
  PY=python
fi

log "Python deps"
"$PY" -m pip install -q -r backend/requirements.txt

if [[ -x "$ROOT/scripts/start-local-infra.sh" ]]; then
  log "Postgres + Redis"
  "$ROOT/scripts/start-local-infra.sh" || {
    log "Infra failed; SQLite fallback"
    export DATABASE_URL="sqlite:///./data/quantum_telemetry.db"
    export USE_ALEMBIC=false
  }
fi

command -v npm >/dev/null || die "npm missing. Install Node via nvm, then rerun."
# shellcheck source=/dev/null
source "$ROOT/scripts/lib/qre-paths.sh"
QRP_FE="$(qrp_frontend_dir || true)"
if [[ -z "$QRP_FE" && -d "$ROOT/../QuantumResourcePortal/frontend" ]]; then
  QRP_FE="$(cd "$ROOT/../QuantumResourcePortal/frontend" && pwd)"
fi
[[ -n "$QRP_FE" && -d "$QRP_FE" ]] || die "QRP frontend missing at /home/cloud/QuantumResourcePortal"
if [[ ! -d "$QRP_FE/node_modules" ]]; then
  log "npm install (QRP)"
  (cd "$QRP_FE" && npm install)
fi

API_PORT="${API_PORT:-8000}"
UI_PORT="${UI_PORT:-5176}"
mkdir -p "$ROOT/logs"

if curl -sf -m 1 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
  log "API already on :${API_PORT}"
else
  log "Start API :${API_PORT}"
  nohup "$PY" -m uvicorn app.main:app --host 0.0.0.0 --port "$API_PORT" >"$ROOT/logs/api.log" 2>&1 &
  echo $! >"$ROOT/logs/api.pid"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -sf -m 1 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if curl -sf -m 1 "http://127.0.0.1:${UI_PORT}/" >/dev/null 2>&1; then
  log "UI already on :${UI_PORT}"
else
  log "Start QRP Vite :${UI_PORT}"
  nohup bash -lc "cd $(printf %q "$QRP_FE") && npm run dev -- --host 0.0.0.0 --port $UI_PORT" >"$ROOT/logs/qrp-ui.log" 2>&1 &
  echo $! >"$ROOT/logs/qrp-ui.pid"
fi

log "API  http://$(hostname -I 2>/dev/null | awk '{print $1}'):${API_PORT}/healthz"
log "QRP  http://$(hostname -I 2>/dev/null | awk '{print $1}'):${UI_PORT}/qrp"
log "Login admin / quantum2026 (lab). MFA/LDAP/forgot-password use live TeleScope APIs."
log "Logs: $ROOT/logs/api.log  $ROOT/logs/qrp-ui.log"
echo
echo "Manual equivalent:"
echo "  source scripts/lib/ensure-dev-path.sh"
echo "  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "  cd \"\$QRP_FE\" && npm install && npm run dev -- --host 0.0.0.0 --port 5176"
