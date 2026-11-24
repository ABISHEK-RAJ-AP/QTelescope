#!/usr/bin/env bash
# Interactive first-time setup for Q-TeleScope VM bundle (run from extracted zip root).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/backend/requirements.txt" ]] || [[ ! -d "$ROOT/app" ]]; then
  echo "Run this from the Q-TeleScope bundle root (contains app/ and backend/)." >&2
  exit 1
fi

prompt() {
  local var="$1" default="$2" label="$3"
  local val
  read -r -p "${label} [${default}]: " val
  if [[ -z "${val}" ]]; then
    val="$default"
  fi
  printf -v "$var" '%s' "$val"
}

yesno() {
  local default="${1:-y}"
  local q="$2"
  local hint="Y/n"
  [[ "$default" == "n" ]] && hint="y/N"
  local ans
  read -r -p "${q} (${hint}): " ans
  ans="${ans:-$default}"
  [[ "$ans" =~ ^[Yy] ]]
}

upsert_env() {
  local key="$1" val="$2"
  local envf="${ROOT}/.env"
  touch "$envf"
  if grep -qE "^${key}=" "$envf" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
  else
    printf '%s=%s\n' "$key" "$val" >>"$envf"
  fi
}

echo "==> Q-TeleScope VM setup"
echo "Root: $ROOT"

if ! command -v python3 >/dev/null; then
  echo "python3 required. Debian/Ubuntu: sudo apt install -y python3 python3-venv" >&2
  exit 1
fi

PUBLIC_ORIGIN=""
prompt PUBLIC_ORIGIN "http://127.0.0.1:4173" "Public browser origin (CORS + email links)"
NGINX_PORT=""
prompt NGINX_PORT "4173" "Nginx listen port for UI"

USE_PG=y
if yesno y "Use PostgreSQL (recommended; SQLite is lab-only)?"; then
  USE_PG=y
else
  USE_PG=n
  echo "WARN: SQLite is not recommended for demo VMs — use PostgreSQL when possible." >&2
fi

EVENT_PROFILE=n
if yesno y "Event / demo profile (mock fleet + public org registration)?"; then
  EVENT_PROFILE=y
else
  EVENT_PROFILE=n
fi

if [[ ! -f "$ROOT/.env" ]]; then
  if [[ -f "$ROOT/.env.vm.template" ]]; then
    cp "$ROOT/.env.vm.template" "$ROOT/.env"
  elif [[ -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
  else
    touch "$ROOT/.env"
  fi
fi

if [[ "$USE_PG" == y ]]; then
  DB_URL="postgresql+psycopg2://postgres:postgrespassword@127.0.0.1:5432/quantum_telemetry"
  upsert_env DATABASE_URL "$DB_URL"
  upsert_env USE_ALEMBIC true
else
  upsert_env DATABASE_URL "sqlite:///./data/qtelescope.db"
fi

upsert_env CORS_ORIGINS "$PUBLIC_ORIGIN"
upsert_env PUBLIC_APP_URL "$PUBLIC_ORIGIN"
upsert_env PERSIST_API_SESSIONS true
upsert_env ENVIRONMENT production
upsert_env REQUIRE_API_AUTH true
upsert_env ENFORCE_RBAC true
upsert_env BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS true
upsert_env E2E_CAPTCHA_BYPASS false
upsert_env ALLOW_ENV_CREDENTIAL_WRITE false
upsert_env TRUSTED_PROXY_RATE_LIMIT true
upsert_env CACHE_ENABLED true

if [[ "$EVENT_PROFILE" == y ]]; then
  upsert_env EVENT_PUBLIC_DEMO true
  upsert_env ENABLE_MOCK_DATA true
  upsert_env ALLOW_PUBLIC_REGISTRATION true
  upsert_env HYBRID_DEMO_ENABLED false
  upsert_env DEMO_LIVE_PROVIDERS ""
  upsert_env REGISTRATION_REQUIRES_ADMIN_APPROVAL false
  # OTP: toast unless SMTP fully configured (see registration_otp_delivery)
  upsert_env REGISTRATION_OTP_DELIVERY auto
else
  upsert_env ENABLE_MOCK_DATA false
  upsert_env ALLOW_PUBLIC_REGISTRATION false
  upsert_env REGISTRATION_OTP_DELIVERY auto
fi

if ! grep -qE '^SECRET_KEY=.{32,}' "$ROOT/.env" 2>/dev/null; then
  upsert_env SECRET_KEY "$(openssl rand -hex 32)"
fi

CONFIGURED_SMTP=n
if yesno n "Configure SMTP now (registration OTP + password reset by email)?"; then
  SMTP_HOST="" SMTP_FROM="" SMTP_USER="" SMTP_PORT="" SMTP_TLS=""
  prompt SMTP_HOST "" "SMTP_HOST"
  prompt SMTP_FROM "" "SMTP_FROM"
  prompt SMTP_USER "" "SMTP_USER (empty if relay allows)"
  read -r -s -p "SMTP_PASSWORD: " SMTP_PASSWORD; echo
  prompt SMTP_PORT "587" "SMTP_PORT"
  prompt SMTP_TLS "true" "SMTP_USE_TLS (true/false)"
  upsert_env SMTP_HOST "$SMTP_HOST"
  upsert_env SMTP_FROM "$SMTP_FROM"
  upsert_env SMTP_USER "$SMTP_USER"
  upsert_env SMTP_PASSWORD "$SMTP_PASSWORD"
  upsert_env SMTP_PORT "$SMTP_PORT"
  upsert_env SMTP_USE_TLS "$SMTP_TLS"
  upsert_env REGISTRATION_OTP_DELIVERY auto
  CONFIGURED_SMTP=y
fi

if [[ "$CONFIGURED_SMTP" != y && "$EVENT_PROFILE" == y ]]; then
  echo "Registration OTP will appear in UI toast (no SMTP)."
fi

if [[ "$EVENT_PROFILE" == y ]]; then
  upsert_env ADMIN_PASSWORD "$(openssl rand -base64 18)"
  upsert_env USER_PASSWORD "$(openssl rand -base64 18)"
  upsert_env SUPERADMIN_PASSWORD "$(openssl rand -base64 18)"
  echo "Bootstrap passwords written to .env (ADMIN_PASSWORD, USER_PASSWORD, SUPERADMIN_PASSWORD)."
else
  if ! grep -qE '^ADMIN_PASSWORD=' "$ROOT/.env" 2>/dev/null; then
    read -r -s -p "ADMIN_PASSWORD: " AP; echo
    upsert_env ADMIN_PASSWORD "$AP"
  fi
fi

echo "==> Python venv + dependencies"
python3 -m venv "$ROOT/.venv"
# shellcheck disable=SC1091
source "$ROOT/.venv/bin/activate"
pip install -q --upgrade pip
pip install -q -r "$ROOT/backend/requirements.txt"

if [[ "$USE_PG" == y ]] && [[ -x "$ROOT/scripts/vm-postgres-migrate.sh" ]]; then
  echo "==> PostgreSQL migrate / auto-setup"
  export QTELESCOPE_PG_AUTO_SETUP="${QTELESCOPE_PG_AUTO_SETUP:-1}"
  export QTELESCOPE_DB_PASSWORD="${QTELESCOPE_DB_PASSWORD:-postgrespassword}"
  "$ROOT/scripts/vm-postgres-migrate.sh" || {
    echo "WARN: Postgres migrate failed — install postgresql + redis or fix DATABASE_URL" >&2
  }
fi

if [[ -x "$ROOT/scripts/vm-ensure-redis-cache.sh" ]]; then
  echo "==> Redis cache"
  "$ROOT/scripts/vm-ensure-redis-cache.sh" "$ROOT" || true
fi

mkdir -p "$ROOT/data"
export PYTHONPATH="$ROOT"
# shellcheck source=scripts/vm-demo-env.sh
if [[ -f "$ROOT/scripts/vm-demo-env.sh" ]]; then
  source "$ROOT/scripts/vm-demo-env.sh"
  load_env_file "$ROOT/.env"
fi
python3 -c "from app.core.schema import apply_schema; from app.core.database import engine; apply_schema(engine)"

if [[ "$EVENT_PROFILE" == y ]] && [[ -f "$ROOT/scripts/seed_demo_fleet.py" ]]; then
  echo "==> Seed demo fleet (mock backends)"
  python3 "$ROOT/scripts/seed_demo_fleet.py" || echo "WARN: demo seed failed — run manually after DB is up" >&2
  if [[ -x "$ROOT/scripts/vm-demo-trim.sh" ]]; then
    "$ROOT/scripts/vm-demo-trim.sh" || true
  fi
fi

if [[ -f "$ROOT/frontend/dist/index.html" ]]; then
  echo "==> Prebuilt UI found (frontend/dist)"
else
  if command -v npm >/dev/null; then
    echo "==> Building frontend (no dist in bundle)"
    (cd "$ROOT/frontend" && npm install && npm run build)
  else
    echo "WARN: no frontend/dist and npm missing — install Node 20+ and npm run build in frontend/" >&2
  fi
fi

if [[ -x "$ROOT/scripts/setup-nginx-host.sh" ]]; then
  if command -v nginx >/dev/null || command -v apt >/dev/null; then
    echo "==> nginx site (port ${NGINX_PORT})"
    export NGINX_PORT SERVER_NAME="_"
    if command -v sudo >/dev/null && [[ "$(id -u)" -ne 0 ]]; then
      if ! sudo -n true 2>/dev/null; then
        echo "sudo required for nginx install — run: NGINX_PORT=${NGINX_PORT} ./scripts/setup-nginx-host.sh"
      else
        FORCE_FREE_PORT=1 NGINX_PORT="$NGINX_PORT" "$ROOT/scripts/setup-nginx-host.sh" || true
      fi
    else
      FORCE_FREE_PORT=1 NGINX_PORT="$NGINX_PORT" "$ROOT/scripts/setup-nginx-host.sh" || true
    fi
  else
    echo "Install nginx manually; template: deployment/nginx-host.conf"
  fi
fi

echo "==> Starting API on :8000"
# shellcheck source=scripts/vm-demo-env.sh
if [[ -f "$ROOT/scripts/vm-demo-env.sh" ]]; then
  restart_uvicorn "$ROOT" || {
    pkill -f 'uvicorn app.main:app' 2>/dev/null || true
    sleep 1
    nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$ROOT/.backend.log" 2>&1 &
    sleep 2
  }
else
  pkill -f 'uvicorn app.main:app' 2>/dev/null || true
  sleep 1
  nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$ROOT/.backend.log" 2>&1 &
  sleep 2
fi

if curl -sf -m 5 "http://127.0.0.1:8000/api/v1/health/live" >/dev/null; then
  echo "API healthy."
else
  echo "WARN: API health check failed — see .backend.log" >&2
fi

echo ""
echo "Done."
echo "  UI:  ${PUBLIC_ORIGIN} (or http://<server-ip>:${NGINX_PORT})"
echo "  API: http://127.0.0.1:8000 (proxied at /api on nginx)"
echo "  Log: ${ROOT}/.backend.log"
echo "  Event origin lock: ./scripts/vm-event-public-demo.sh '${PUBLIC_ORIGIN}'"
echo "  Restart (no git): source .venv/bin/activate && export PYTHONPATH=. && ./scripts/vm-demo-env.sh helpers via vm-demo-restart if present"