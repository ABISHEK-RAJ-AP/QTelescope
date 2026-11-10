#!/usr/bin/env bash
# Smoke-test local stack (no Docker). Exit non-zero on failure.
set -euo pipefail
API="${API_BASE:-http://127.0.0.1:8000/api/v1}"
PROXY="${VITE_PROXY:-http://127.0.0.1:5173/api/v1}"

fail() { echo "FAIL: $*" >&2; exit 1; }

curl_ok() {
  local url=$1 name=$2
  local code body
  body=$(curl -sf -m 15 "$url") || fail "$name unreachable at $url (is backend on :8000?)"
  echo "OK $name"
  [[ -n "$body" ]] || fail "$name empty body"
}

echo "=== Infra ==="
DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" && -f .env ]]; then
  DB_URL=$(grep -m1 '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)
fi
if [[ "${STACK_VERIFY_SKIP_INFRA:-0}" == "1" || "$DB_URL" == sqlite* ]]; then
  echo "SKIP PostgreSQL/Redis (sqlite or STACK_VERIFY_SKIP_INFRA=1)"
else
  export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:$PATH"
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h localhost -p 5432 -U postgres >/dev/null || fail "PostgreSQL not ready (run scripts/start-local-infra.sh)"
  else
    fail "pg_isready not found — install Postgres client or set DATABASE_URL=sqlite:///./data/qtelescope.db"
  fi
  redis-cli ping 2>/dev/null | grep -q PONG || fail "Redis not responding"
fi

echo "=== API (direct :8000) ==="
curl_ok "$API/auth/captcha" "captcha"
curl_ok "$API/alerts/summary" "alerts/summary"
curl_ok "$API/backends/status-all" "backends/status-all"
curl -sf -m 60 "$API/health/vector" >/dev/null || fail "health/vector timeout"
echo "OK health/vector"

echo "=== API (Vite proxy :5173) ==="
if curl -sf -m 3 -o /dev/null "$PROXY/auth/captcha" 2>/dev/null; then
  curl_ok "$PROXY/auth/captcha" "proxy captcha"
else
  echo "SKIP vite proxy (frontend not on :5173)"
fi

echo "=== All checks passed ==="
