#!/usr/bin/env bash
# After git pull on the Guacamole / VAPT VM: rebuild UI, remind prod flags, restart API.
# Usage: ./scripts/vm-vapt-restart.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull

echo "==> Frontend nginx (port ${NGINX_PORT:-4173})"
FORCE_FREE_PORT=1 "${ROOT}/scripts/setup-nginx-host.sh"

echo ""
echo "VAPT .env must include (edit then restart uvicorn):"
echo "  ENVIRONMENT=production"
echo "  ENABLE_MOCK_DATA=false"
echo "  REQUIRE_API_AUTH=true"
echo "  ENFORCE_RBAC=true"
echo "  BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=true"
echo "  PERSIST_API_SESSIONS=true"
echo "  SECRET_KEY=<openssl rand -hex 32>"
echo "  ADMIN_PASSWORD / USER_PASSWORD not quantum2026"
echo "  CORS_ORIGINS=http://THIS_VM_IP:${NGINX_PORT:-4173}"
echo "  Rigetti: no API key required — public QCS ISA"
echo "  IBM: IBM_QUANTUM_TOKEN  IonQ: IONQ_API_KEY  on-prem: ONPREM_QPU_URL"
echo ""
echo "Restart API (other terminal):"
echo "  pkill -f 'uvicorn app.main:app' || true"
echo "  source .venv/bin/activate 2>/dev/null || true"
echo "  export PYTHONPATH=."
echo "  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "Then Admin → Integrations → save Rigetti (token optional) or trigger discovery."
