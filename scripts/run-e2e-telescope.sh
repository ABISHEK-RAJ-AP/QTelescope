#!/usr/bin/env bash
# Lab TeleScope Playwright gate (API + Vite must already be running, or start in other terminals).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/tests/e2e"

export E2E_PLAYWRIGHT=1
export E2E_CAPTCHA_BYPASS=1
export E2E_API_URL="${E2E_API_URL:-http://127.0.0.1:8000}"
export E2E_TELESCOPE_URL="${E2E_TELESCOPE_URL:-http://127.0.0.1:5173}"
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-/usr/bin/chromium}"
export PW_WORKERS="${PW_WORKERS:-1}"

if [[ ! -d node_modules ]]; then
  npm install
fi

npx playwright test --project=telescope "$@"
