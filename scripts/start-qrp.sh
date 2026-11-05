#!/usr/bin/env bash
# Launch Quantum Resource Portal (QRP): shared Postgres/Redis + API (:8000) + QRP Vite (:5176).
# Portal UI is QuantumResourcePortal; this script starts TeleScope API and that Vite app.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# Portal UI lives in QuantumResourcePortal. Local nested copy is optional.
if [[ -n "${QRP_ROOT:-}" && -d "${QRP_ROOT}/frontend" ]]; then
  QRP_FE="$(cd "$QRP_ROOT/frontend" && pwd)"
elif [[ -d "$ROOT/../QuantumResourcePortal/frontend" ]]; then
  QRP_FE="$(cd "$ROOT/../QuantumResourcePortal/frontend" && pwd)"
elif [[ -d "$ROOT/quantum-resource-portal/frontend" ]]; then
  QRP_FE="$(cd "$ROOT/quantum-resource-portal/frontend" && pwd)"
else
  QRP_FE=""
fi

# shellcheck source=/dev/null
source "$ROOT/scripts/lib/ensure-dev-path.sh"

log() { printf '\033[1;36m[qrp]\033[0m %s\n' "$*"; }
pause_fail() {
  printf '\033[1;31m[qrp]\033[0m %s\n' "$*" >&2
  read -r -p "Press Enter to close… " _
  exit 1
}
pause_ok() {
  if [[ "${QTELESCOPE_LAUNCHER_NO_PAUSE:-}${LAUNCHER_NO_PAUSE:-}" == *"1"* ]]; then
    log "$* (no-pause)"
    return 0
  fi
  read -r -p "$*" _
}

spawn_term() {
  local title="$1"
  shift
  local cmd="$*"
  local path_boot="source $(printf %q "$ROOT/scripts/lib/ensure-dev-path.sh")"
  local wrapped="cd $(printf %q "$ROOT"); $path_boot; $cmd; ec=\$?; echo; echo \"[exit \$ec]\"; read -r -p 'Press Enter to close this terminal… ' _"
  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -lc "$wrapped" &
    return 0
  fi
  if command -v konsole >/dev/null 2>&1; then
    konsole -p tabtitle="$title" -e bash -lc "$wrapped" &
    return 0
  fi
  if command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --title="$title" -e "bash -lc $(printf %q "$wrapped")" &
    return 0
  fi
  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -lc "$wrapped" &
    return 0
  fi
  log "No GUI terminal — running inline: $title"
  bash -lc "$wrapped"
}

[[ -n "$QRP_FE" && -d "$QRP_FE" ]] || pause_fail "QRP frontend missing. Clone QuantumResourcePortal next to this repo, or set QRP_ROOT, or keep a local quantum-resource-portal/frontend."
command -v npm >/dev/null || pause_fail "npm not found (install Node.js / nvm). PATH=$PATH"

export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:${PATH:-}"
PY=""
if [[ -x "${MINIFORGE_BIN:-$HOME/miniforge3/bin}/python" ]]; then
  PY="${MINIFORGE_BIN:-$HOME/miniforge3/bin}/python"
elif [[ -x "$ROOT/.venv/bin/python" && -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
  PY=python
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  PY="$ROOT/.venv/bin/python"
else
  log "Creating monorepo .venv for API…"
  python3 -m venv .venv || pause_fail "python3-venv missing"
  # shellcheck source=/dev/null
  source .venv/bin/activate
  pip install -q -r backend/requirements.txt
  PY=python
fi

if ! "$PY" -c "import uvicorn" 2>/dev/null; then
  log "Installing API Python deps…"
  "$PY" -m pip install -q -r backend/requirements.txt || pause_fail "pip install failed"
fi

[[ -f .env ]] || { cp backend/.env.example .env && log "Created .env from backend/.env.example"; }
set -a && source .env && set +a
export COLLECTION_SCHEDULER_ENABLED="${COLLECTION_SCHEDULER_ENABLED:-false}"
export PYTHONPATH="$ROOT"

if [[ -x "$ROOT/scripts/start-local-infra.sh" ]]; then
  log "Ensuring PostgreSQL + Redis…"
  if ! "$ROOT/scripts/start-local-infra.sh"; then
    log "Infra failed — SQLite fallback."
    export DATABASE_URL="sqlite:///./data/quantum_telemetry.db"
    export USE_ALEMBIC=false
  fi
else
  export DATABASE_URL="${DATABASE_URL:-sqlite:///./data/quantum_telemetry.db}"
  export USE_ALEMBIC=false
fi

if [[ "${DATABASE_URL:-}" == postgresql* ]] && ! "$PY" -c "import psycopg2" 2>/dev/null; then
  log "psycopg2 missing — SQLite fallback."
  export DATABASE_URL="sqlite:///./data/quantum_telemetry.db"
  export USE_ALEMBIC=false
fi

if [[ ! -d "$QRP_FE/node_modules" ]]; then
  log "Installing QRP frontend deps…"
  (cd "$QRP_FE" && npm install) || pause_fail "npm install failed in quantum-resource-portal/frontend"
fi

API_UP=0
UI_UP=0
if curl -sf -m 2 http://127.0.0.1:8000/api/v1/auth/captcha >/dev/null 2>&1 \
  || curl -sf -m 2 http://127.0.0.1:8000/api/v1/governance/summary >/dev/null 2>&1; then
  log "API already up on :8000"
  API_UP=1
fi
if curl -sf -m 1 -o /dev/null http://127.0.0.1:5176/ 2>/dev/null; then
  log "QRP UI already up on :5176"
  UI_UP=1
fi

ENV_EXPORT="export PATH=$(printf %q "${PATH}"); export PYTHONPATH=$(printf %q "$ROOT"); set -a; [[ -f .env ]] && source .env; set +a; export COLLECTION_SCHEDULER_ENABLED=false; export DATABASE_URL=$(printf %q "${DATABASE_URL}"); export USE_ALEMBIC=$(printf %q "${USE_ALEMBIC:-false}")"

if [[ "$API_UP" -eq 0 ]]; then
  if command -v ss >/dev/null && ss -ltn | grep -q ':8000 '; then
    pause_fail "Port 8000 in use but API not responding. Stop the other process."
  fi
  log "Opening terminal: QRE/Q-TeleScope API :8000"
  spawn_term "QRP API :8000" \
    "$ENV_EXPORT; $(printf %q "$PY") -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
fi

if [[ "$UI_UP" -eq 0 ]]; then
  if command -v ss >/dev/null && ss -ltn | grep -q ':5176 '; then
    pause_fail "Port 5176 already in use. Open http://127.0.0.1:5176/qrp or stop that Vite."
  fi
  log "Opening terminal: QRP UI :5176"
  spawn_term "QRP UI :5176" \
    "export PATH=$(printf %q "${PATH}"); cd quantum-resource-portal/frontend && npm run dev -- --host 127.0.0.1 --port 5176"
fi

sleep 2
command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:5176/qrp" >/dev/null 2>&1 || true

log "Infra ready. API + QRP UI in their own terminals."
log "  API      http://127.0.0.1:8000"
log "  Portal   http://127.0.0.1:5176/qrp"
echo
pause_ok "Launcher OK — Press Enter to close this window (servers keep running)… "
