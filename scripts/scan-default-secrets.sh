#!/usr/bin/env bash
# Fail if tracked files still contain lab bootstrap passwords (pre-public-deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PATTERN='quantum2026|your_secret_key_here|cdac_quantum_telemetry_secret_key'
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES=$(git ls-files)
else
  FILES=$(find . -type f \( -name '*.py' -o -name '*.js' -o -name '*.jsx' -o -name '*.md' -o -name '*.example' \) ! -path './frontend/dist/*' ! -path './node_modules/*')
fi
HITS=0
while IFS= read -r f; do
  [[ -z "$f" || ! -f "$f" ]] && continue
  case "$f" in
    */.env|*/.env.*|*.env.example|*test_*|*e2e*|*LoginPage*|*bootstrap_security*|*config.py|*devAuthConfig*|docs/*|scripts/vm-*|*scan-default-secrets*) continue ;;
  esac
  if grep -qE "$PATTERN" "$f" 2>/dev/null; then
    echo "DEFAULT-SECRET? $f"
    HITS=$((HITS + 1))
  fi
done <<< "$FILES"
if [[ "$HITS" -gt 0 ]]; then
  echo "$HITS unexpected file(s) mention default secrets — review before public deploy."
  [[ "${STRICT_DEFAULT_SECRET_SCAN:-}" == 1 ]] && exit 1
  exit 0
fi
echo "No unexpected default secret strings in application source."
