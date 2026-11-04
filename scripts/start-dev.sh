#!/usr/bin/env bash
# Launch Q-TeleScope: Postgres + Redis + API (:8000) + Vite (:5173) in separate terminals.
# Desktop / Start-QuantumMonitoring.ps1 call this. Windows: see Start-QuantumMonitoring.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/scripts/lib/ensure-dev-path.sh"

log() { printf '\033[1;36m[qtelescope]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[qtelescope]\033[0m %s\n' "$*" >&2; exit 1; }

pause_fail() {
  printf '\033[1;31m[qtelescope]\033[0m %s\n' "$*" >&2
  read -r -p "Press Enter to close… " _
  exit 1
}

# Open a titled terminal that stays open after the command exits (fixes “flash and gone”).
spawn_term() {
  local title="$1"
  shift
  local cmd="$*"
  # Re-ensure PATH inside child (gnome-terminal may reset env)
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
  # Fallback: same shell (no separate window)
  log "No GUI terminal found — running inline: $title"
  bash -lc "$wrapped"
}

command -v npm >/dev/null || pause_fail "npm not found (install Node.js / nvm, then reopen). PATH=$PATH"

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
  log "Creating .venv…"
  python3 -m venv .venv || pause_fail "python3-venv missing — use Miniforge or apt install python3-venv"
  # shellcheck source=/dev/null
  source .venv/bin/activate
  pip install -q -r backend/requirements.txt
  PY=python
fi

if ! "$PY" -c "import uvicorn" 2>/dev/null; then
  log "Installing Python dependencies…"
  "$PY" -m pip install -q -r backend/requirements.txt || pause_fail "pip install failed"
fi

[[ -f .env ]] || { cp backend/.env.example .env && log "Created .env from backend/.env.example"; }
set -a && source .env && set +a
export COLLECTION_SCHEDULER_ENABLED="${COLLECTION_SCHEDULER_ENABLED:-false}"
export PYTHONPATH="$ROOT"

if [[ -x "$ROOT/scripts/start-local-infra.sh" ]]; then
  log "Ensuring PostgreSQL + Redis…"
  if ! "$ROOT/scripts/start-local-infra.sh"; then
    log "Infra start failed — falling back to SQLite for local lab."
    export DATABASE_URL="${DATABASE_URL_FALLBACK:-sqlite:///./data/quantum_telemetry.db}"
    export USE_ALEMBIC=false
  fi
else
  log "No start-local-infra.sh — using SQLite."
  export DATABASE_URL="${DATABASE_URL:-sqlite:///./data/quantum_telemetry.db}"
  export USE_ALEMBIC=false
fi

# If Postgres URL but no psycopg2, fall back to SQLite so desktop launch still works
if [[ "${DATABASE_URL:-}" == postgresql* ]] && ! "$PY" -c "import psycopg2" 2>/dev/null; then
  log "psycopg2 missing — SQLite fallback for this session."
  export DATABASE_URL="sqlite:///./data/quantum_telemetry.db"
  export USE_ALEMBIC=false
fi

if [[ ! -d frontend/node_modules ]]; then
  log "Installing frontend dependencies…"
  (cd frontend && npm install) || pause_fail "npm install failed in frontend/"
fi

API_UP=0
UI_UP=0
if curl -sf -m 2 http://127.0.0.1:8000/api/v1/auth/captcha >/dev/null 2>&1; then
  log "Backend already up on :8000"
  API_UP=1
fi
if curl -sf -m 1 -o /dev/null http://127.0.0.1:5173/ 2>/dev/null; then
  log "Frontend already up on :5173"
  UI_UP=1
fi

# Child: load .env then re-apply session overrides (SQLite fallback must win)
ENV_EXPORT="export PATH=$(printf %q "${PATH}"); export PYTHONPATH=$(printf %q "$ROOT"); set -a; [[ -f .env ]] && source .env; set +a; export COLLECTION_SCHEDULER_ENABLED=false; export DATABASE_URL=$(printf %q "${DATABASE_URL}"); export USE_ALEMBIC=$(printf %q "${USE_ALEMBIC:-false}")"

if [[ "$API_UP" -eq 0 ]]; then
  if command -v ss >/dev/null && ss -ltn | grep -q ':8000 '; then
    pause_fail "Port 8000 in use but not Q-TeleScope API. Stop the other process."
  fi
  log "Opening terminal: Q-TeleScope API :8000"
  spawn_term "Q-TeleScope API :8000" \
    "$ENV_EXPORT; $(printf %q "$PY") -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
fi

if [[ "$UI_UP" -eq 0 ]]; then
  if command -v ss >/dev/null && ss -ltn | grep -q ':5173 '; then
    pause_fail "Port 5173 already in use. Stop the other Vite process or open http://127.0.0.1:5173/"
  fi
  log "Opening terminal: Q-TeleScope UI :5173"
  spawn_term "Q-TeleScope UI :5173" \
    "export PATH=$(printf %q "${PATH}"); cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"
fi

sleep 2
command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:5173/" >/dev/null 2>&1 || true

log "Postgres/Redis ready (or SQLite fallback). API + UI in their own terminals."
log "  Backend  http://127.0.0.1:8000"
log "  Frontend http://127.0.0.1:5173"
echo
# Non-interactive test mode: skip pause
if [[ "${QTELESCOPE_LAUNCHER_NO_PAUSE:-}" == "1" ]]; then
  log "Launcher OK (no-pause test mode)."
  exit 0
fi
read -r -p "Launcher OK — Press Enter to close this window (servers keep running)… " _
