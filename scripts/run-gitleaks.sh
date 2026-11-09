#!/usr/bin/env bash
# Scan repo for secrets (install: https://github.com/gitleaks/gitleaks#installing)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks not installed — skip or: go install github.com/gitleaks/gitleaks/v8@latest"
  exit 0
fi
gitleaks detect --source "$ROOT" --no-git -v --redact
echo "gitleaks: OK"
