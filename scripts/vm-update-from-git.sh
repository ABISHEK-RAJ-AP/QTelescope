#!/usr/bin/env bash
# VM / lab: pull latest, migrate DB, rebuild frontend, restart API (+ optional nginx).
# Usage (repo root on Ubuntu demo VM):
#   chmod +x scripts/vm-update-from-git.sh
#   ./scripts/vm-update-from-git.sh
# Options:
#   VM_BRANCH=main     git branch to pull
#   VM_NGINX=1         run setup-nginx-host.sh after build (default 1)
#   VM_DEMO_ENV=1      apply demo .env keys like vm-demo-restart.sh (default 0)
#   SKIP_TESTS=1       skip pytest + frontend vitest
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${VM_BRANCH:-main}"
RUN_NGINX="${VM_NGINX:-1}"
RUN_DEMO_ENV="${VM_DEMO_ENV:-0}"
SKIP_TESTS="${SKIP_TESTS:-0}"

echo "==> git pull ($BRANCH)"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH" || {
  echo "WARN: ff-only pull failed; resolve conflicts manually" >&2
  exit 1
}

chmod +x scripts/*.sh 2>/dev/null || true

if [[ "$RUN_DEMO_ENV" == "1" ]]; then
  exec "${ROOT}/scripts/vm-demo-restart.sh"
fi

REQ="${ROOT}/backend/requirements.txt"
if [[ -f "$REQ" ]]; then
  echo "==> Python deps ($REQ)"
  if [[ -d .venv ]]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
  elif [[ -d venv ]]; then
    # shellcheck disable=SC1091
    source venv/bin/activate
  fi
  pip install -q -r "$REQ"
fi

echo "==> Alembic migrate"
export PYTHONPATH="${ROOT}"
if command -v alembic >/dev/null 2>&1; then
  alembic upgrade head
else
  python -m alembic upgrade head
fi

echo "==> Frontend build"
cd "${ROOT}/frontend"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build
cd "$ROOT"

if [[ "$SKIP_TESTS" != "1" ]]; then
  echo "==> Tests (quick)"
  python -m pytest tests/test_bootstrap_security.py tests/test_incidents_list_batch.py tests/test_password_reset_ttl.py -q || true
  (cd frontend && npm run test) || true
fi

if [[ "$RUN_NGINX" == "1" ]] && [[ -x "${ROOT}/scripts/setup-nginx-host.sh" ]]; then
  echo "==> nginx static + proxy"
  FORCE_FREE_PORT=1 "${ROOT}/scripts/setup-nginx-host.sh"
fi

echo "==> Restart API"
pkill -f 'uvicorn app.main:app' 2>/dev/null || true
sleep 1
if [[ -f .env ]]; then
  set -a && source .env && set +a
fi
export PYTHONPATH="${ROOT}"
if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "${ROOT}/.backend.log" 2>&1 &
echo "API log: ${ROOT}/.backend.log"

echo "==> Health check"
sleep 2
"${ROOT}/scripts/verify-stack.sh" || true

echo ""
echo "Done. Hard-refresh browser (Ctrl+Shift+R)."
echo "Demo reset .env: VM_DEMO_ENV=1 ./scripts/vm-update-from-git.sh"
