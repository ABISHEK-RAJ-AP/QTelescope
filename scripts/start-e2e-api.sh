#!/usr/bin/env bash
# Start API for TeleScope Playwright (lab SQLite, captcha bypass, sessions persisted, auth enforced).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export USE_ALEMBIC=false
export DATABASE_URL="${DATABASE_URL:-sqlite:///./data/qtelescope.db}"
export E2E_CAPTCHA_BYPASS=1
export PERSIST_API_SESSIONS=true
export REQUIRE_API_AUTH=true
export ENFORCE_RBAC=true
export PYTHONPATH=.
exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
