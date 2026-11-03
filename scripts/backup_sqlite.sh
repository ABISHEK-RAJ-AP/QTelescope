#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/backups"
mkdir -p "$OUT"
tar -czf "$OUT/qtelescope_data_${TS}.tar.gz" -C "$ROOT" data
echo "Wrote $OUT/qtelescope_data_${TS}.tar.gz"
