#!/usr/bin/env bash
# Quick API latency smoke (requires running API on :8000).
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000/api/v1}"
paths=(
  "/backends"
  "/backends/status-all"
  "/operations/centre"
  "/alerts/summary"
  "/health/vector"
)
for p in "${paths[@]}"; do
  ms=$(curl -sf -o /dev/null -w '%{time_total}' "${BASE}${p}" 2>/dev/null | awk '{printf "%.0f", $1*1000}')
  echo "${ms}ms ${p}"
done