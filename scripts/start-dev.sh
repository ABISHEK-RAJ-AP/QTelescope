#!/usr/bin/env bash
# Launch Q-TeleScope: Postgres + Redis + API (:8000) + Vite (:5173) in separate terminals.
# Desktop / Start-QuantumMonitoring.ps1 call this. Windows: see Start-QuantumMonitoring.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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
  local wrapped="cd $(printf %q "$ROOT"); $cmd; ec=\$?; echo; echo \"[exit \$ec]\"; read -r -p 'Press Enter to close this terminal… ' _"
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
  bash -lc "$cmd"
}

command -v npm >/dev/null || pause_fail "npm not found"

export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:${PATH:-}"
if [[ -x "${MINIFORGE_BIN:-$HOME/miniforge3/bin}/python" ]]; then
  PY="${MINIFORGE_BIN:-$HOME/miniforge3/bin}/python"
elif [[ -d "$ROOT/.venv" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
  PY=python
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
  "$PY" -m pip install -q -r backend/requirements.txt
fi

[[ -f .env ]] || { cp backend/.env.example .env && log "Created .env from backend/.env.example"; }
set -a && source .env && set +a
export COLLECTION_SCHEDULER_ENABLED="${COLLECTION_SCHEDULER_ENABLED:-false}"
export PYTHONPATH="$ROOT"

if [[ -x "$ROOT/scripts/start-local-infra.sh" ]]; then
  log "Ensuring PostgreSQL + Redis…"
  "$ROOT/scripts/start-local-infra.sh" || pause_fail "Infra start failed. Run scripts/setup-local-infra.sh once."
else
  pause_fail "Missing scripts/start-local-infra.sh — run scripts/setup-local-infra.sh once"
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

if [[ "$API_UP" -eq 0 ]]; then
  if command -v ss >/dev/null && ss -ltn | grep -q ':8000 '; then
    pause_fail "Port 8000 in use but not Q-TeleScope API. Stop the other process."
  fi
  log "Opening terminal: Q-TeleScope API :8000"
  spawn_term "Q-TeleScope API :8000" \
    "export PATH=$(printf %q "${PATH}"); export PYTHONPATH=$(printf %q "$ROOT"); export COLLECTION_SCHEDULER_ENABLED=false; set -a; [[ -f .env ]] && source .env; set +a; $(printf %q "$PY") -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
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

log "Postgres/Redis ready. API + UI in their own terminals."
log "  Backend  http://127.0.0.1:8000"
log "  Frontend http://127.0.0.1:5173"
echo
read -r -p "Launcher OK — Press Enter to close this window (servers keep running)… " _
