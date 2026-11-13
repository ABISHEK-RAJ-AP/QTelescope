#!/usr/bin/env bash
# Lab VM only: throw away local tracked edits and match origin/main exactly.
# Untracked files (artifacts/, docs/audit/, …) are left alone.
# Usage:
#   chmod +x scripts/vm-force-sync.sh
#   ./scripts/vm-force-sync.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${VM_BRANCH:-main}"

echo "==> fetch origin/$BRANCH"
git fetch origin "$BRANCH"

echo "==> before: $(git rev-parse --short HEAD)  remote: $(git rev-parse --short "origin/$BRANCH")"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "==> discarding local tracked changes (git reset --hard)"
  git reset --hard "origin/$BRANCH"
else
  git merge --ff-only "origin/$BRANCH" || git reset --hard "origin/$BRANCH"
fi

echo "==> after:  $(git rev-parse --short HEAD)"
git status -sb | head -20
echo ""
echo "Next: bash scripts/vm-demo-restart.sh"
echo "  or: SKIP_TESTS=1 VM_DEMO_ENV=1 ./scripts/vm-update-from-git.sh"
