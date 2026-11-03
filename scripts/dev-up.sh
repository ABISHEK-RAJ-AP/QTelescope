#!/usr/bin/env bash
# Start Postgres + Redis + backend for local dev (no Docker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:$PATH"
cd "$ROOT"

[[ -f .env ]] || { cp backend/.env.example .env; echo "Created .env from backend/.env.example"; }

"$ROOT/scripts/start-local-infra.sh"

if pgrep -f "uvicorn app.main:app" >/dev/null 2>&1; then
  echo "Backend already running (uvicorn app.main:app)"
else
  set -a && source .env && set +a
  export COLLECTION_SCHEDULER_ENABLED="${COLLECTION_SCHEDULER_ENABLED:-false}"
  nohup python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \
    > "$ROOT/.backend.log" 2>&1 &
  echo "Backend starting (log: .backend.log)"
fi

for i in $(seq 1 40); do
  if curl -sf -m 2 http://127.0.0.1:8000/api/v1/auth/captcha >/dev/null; then
    echo "Backend ready: http://127.0.0.1:8000"
    echo "Frontend (run separately): cd frontend && npm run dev"
    echo "  → http://127.0.0.1:5173  (proxies /api → :8000)"
    if [[ "${REFRESH_DEMO_DATA:-true}" == "true" ]]; then
      set -a && source .env && set +a
      python "$ROOT/scripts/refresh_demo_fleet.py" --force || echo "WARN: demo refresh failed (see above)" >&2
    fi
    "$ROOT/scripts/verify-stack.sh"
    exit 0
  fi
  sleep 1
done

echo "Backend did not become ready in 40s. Tail .backend.log:" >&2
tail -30 "$ROOT/.backend.log" >&2 || true
exit 1
