#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== Q-TeleScope air-gap preflight =="
command -v docker >/dev/null || { echo "FAIL: docker not found"; exit 1; }
docker compose version >/dev/null || { echo "FAIL: docker compose not found"; exit 1; }

for port in 8000 80; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    echo "WARN: port ${port} already in use"
  else
    echo "OK: port ${port} free"
  fi
done

mkdir -p data/facility_inbox data/federation_snapshots
echo "OK: data directories"

if [[ ! -f .env ]]; then
  echo "HINT: copy deployment/airgap/.env.airgap.example to .env"
fi

if [[ -f docker-compose.airgap.yml ]] && [[ -f docker-compose.yml ]]; then
  echo "OK: compose files present"
else
  echo "FAIL: missing docker-compose.yml or docker-compose.airgap.yml"
  exit 1
fi

USE_ALEMBIC=false PYTHONPATH=. python3 -c "
from app.core.deployment import deployment_profile
p = deployment_profile()
assert 'profile' in p
print('OK: deployment profile', p.get('profile'))
" || { echo "FAIL: Python deployment profile check"; exit 1; }

echo "Preflight done."
