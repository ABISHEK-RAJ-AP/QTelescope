#!/usr/bin/env bash
# Dependency CVE scan — optional gate before release (non-blocking unless AUDIT_FAIL_ON=high).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL_ON="${AUDIT_FAIL_ON:-high}"
PY_OK=0
JS_OK=0

echo "== Python (pip-audit) =="
if command -v pip-audit >/dev/null 2>&1; then
  pip-audit -r backend/requirements.txt && PY_OK=1 || PY_OK=0
elif python3 -m pip_audit --version >/dev/null 2>&1; then
  python3 -m pip_audit -r backend/requirements.txt && PY_OK=1 || PY_OK=0
else
  echo "SKIP: install pip-audit (pip install pip-audit)"
  PY_OK=1
fi

echo "== Frontend (npm audit) =="
if [[ -f frontend/package.json ]]; then
  (cd frontend && npm audit --audit-level="$FAIL_ON") && JS_OK=1 || JS_OK=0
else
  JS_OK=1
fi

if [[ "$PY_OK" -eq 0 ]] || [[ "$JS_OK" -eq 0 ]]; then
  echo "dependency-audit: failed"
  exit 1
fi
echo "dependency-audit: OK"
