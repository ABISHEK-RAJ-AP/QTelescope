#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:$PATH"
cd "$ROOT"
[[ -f .env ]] && set -a && source .env && set +a
./scripts/start-local-infra.sh
export COLLECTION_SCHEDULER_ENABLED="${COLLECTION_SCHEDULER_ENABLED:-false}"
exec python -m uvicorn app.main:app --host "${HOST:-127.0.0.1}" --port "${PORT:-8000}" --reload
