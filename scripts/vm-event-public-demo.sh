#!/usr/bin/env bash
# Public event VM: production headers + auth/RBAC + unique bootstrap passwords,
# while keeping register → screen OTP toast → /app/onboarding (see docs/security/DEMO_SECURITY_CONFIGURATION.md).
#
# Usage:
#   ./scripts/vm-event-public-demo.sh 'https://YOUR_PUBLIC_HOST'
#   ./scripts/vm-event-public-demo.sh 'http://203.0.113.10:4173'
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/vm-demo-env.sh
source "${ROOT}/scripts/vm-demo-env.sh"

PUBLIC_ORIGIN="${1:-}"
if [[ -z "$PUBLIC_ORIGIN" ]]; then
  echo "Usage: $0 <PUBLIC_APP_URL-or-CORS origin>" >&2
  echo "Example: $0 'https://qtelescope-demo.example.gov.in'" >&2
  exit 1
fi

apply_vm_event_public_demo_env() {
  local ROOT="${1:?}"
  local origin="${2:?}"
  local envf="${ROOT}/.env"
  local credfile="${ROOT}/data/event-bootstrap-passwords.txt"

  touch "$envf"
  if grep -qE '^EVENT_PUBLIC_DEMO=' "$envf"; then
    sed -i 's|^EVENT_PUBLIC_DEMO=.*|EVENT_PUBLIC_DEMO=true|' "$envf"
  else
    printf '%s\n' 'EVENT_PUBLIC_DEMO=true' >>"$envf"
  fi
  apply_vm_demo_env "$ROOT"

  upsert_env() {
    local key="$1" val="$2"
    touch "$envf"
    if grep -qE "^${key}=" "$envf"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
    else
      printf '%s=%s\n' "$key" "$val" >> "$envf"
    fi
  }

  mkdir -p "${ROOT}/data"
  local admin_pw user_pw super_pw
  admin_pw="$(openssl rand -base64 18)"
  user_pw="$(openssl rand -base64 18)"
  super_pw="$(openssl rand -base64 18)"

  upsert_env ENVIRONMENT production
  upsert_env QRE_PROFILE production
  upsert_env EVENT_PUBLIC_DEMO true
  upsert_env REQUIRE_API_AUTH true
  upsert_env ENFORCE_RBAC true
  upsert_env BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS true
  upsert_env ALLOW_PUBLIC_REGISTRATION true
  upsert_env ENABLE_MOCK_DATA true
  upsert_env REGISTRATION_OTP_DELIVERY screen
  upsert_env REGISTRATION_REQUIRES_ADMIN_APPROVAL false
  upsert_env E2E_CAPTCHA_BYPASS false
  upsert_env PERSIST_API_SESSIONS true
  upsert_env CORS_ORIGINS "$origin"
  upsert_env PUBLIC_APP_URL "$origin"
  upsert_env AUTH_RATE_LIMIT 30
  upsert_env AUTH_RATE_WINDOW_SEC 60
  upsert_env TRUSTED_PROXY_RATE_LIMIT true
  upsert_env ADMIN_PASSWORD "$admin_pw"
  upsert_env USER_PASSWORD "$user_pw"
  upsert_env SUPERADMIN_PASSWORD "$super_pw"
  # Simulated fleet only on the booth floor — no live Rigetti poll unless operator opts in.
  upsert_env HYBRID_DEMO_ENABLED false
  upsert_env DEMO_LIVE_PROVIDERS ""

  {
    echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — store offline; shred after event."
    echo "admin=${ADMIN_USERNAME:-admin} password=<see .env ADMIN_PASSWORD>"
    echo "user=${USER_USERNAME:-user_researcher} password=<see .env USER_PASSWORD>"
    echo "superadmin=${SUPERADMIN_USERNAME:-superadmin} password=<see .env SUPERADMIN_PASSWORD>"
    echo ""
    echo "Bootstrap passwords were written to ${envf} (not duplicated here)."
  } >"$credfile"
  chmod 600 "$credfile"

  echo "Event public-demo .env applied."
  echo "  CORS_ORIGINS/PUBLIC_APP_URL=${origin}"
  echo "  Bootstrap password hints: ${credfile}"
  echo "  ACCEPTED RISK: screen_otp in API JSON — booth traffic only; rotate SECRET_KEY post-event."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  apply_vm_event_public_demo_env "$ROOT" "$PUBLIC_ORIGIN"
  echo ""
  echo "Next: rebuild UI, restrict firewall to 80/443 (API :8000 private), restart API:"
  echo "  FORCE_FREE_PORT=1 ${ROOT}/scripts/setup-nginx-host.sh"
  echo "  ${ROOT}/scripts/vm-event-restart.sh"
fi