#!/usr/bin/env bash
# Deprecated convenience wrapper from the Q-TeleScope monorepo.
# QRP is QuantumResourcePortal — own backend + frontend, not TeleScope :8000.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\033[1;36m[vm-qrp]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[vm-qrp]\033[0m %s\n' "$*" >&2; exit 1; }

QRP_ROOT="${QRP_ROOT:-/home/cloud/QuantumResourcePortal}"
if [[ ! -d "$QRP_ROOT/scripts/vm-setup.sh" && -d "$ROOT/../QuantumResourcePortal/scripts/vm-setup.sh" ]]; then
  QRP_ROOT="$(cd "$ROOT/../QuantumResourcePortal" && pwd)"
fi
if [[ ! -f "$QRP_ROOT/scripts/vm-setup.sh" ]]; then
  die "QRP not at $QRP_ROOT. Clone git@github.com:ABISHEK-RAJ-AP/QuantumResourcePortal.git to /home/cloud/QuantumResourcePortal"
fi

log "QRP lives in $QRP_ROOT (not Q-TeleScope)"
exec bash "$QRP_ROOT/scripts/vm-setup.sh"
