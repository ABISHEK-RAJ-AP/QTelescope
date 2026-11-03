#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/backups"
mkdir -p "$OUT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to a postgresql:// or postgresql+psycopg2:// URL" >&2
  exit 1
fi

# pg_dump expects postgresql:// without +driver
URL="${DATABASE_URL/postgresql+psycopg2/postgresql}"
URL="${URL/postgresql+psycopg/postgresql}"

FILE="$OUT/pg_quantum_telemetry_${TS}.sql.gz"
pg_dump "$URL" | gzip > "$FILE"
echo "Wrote $FILE"
