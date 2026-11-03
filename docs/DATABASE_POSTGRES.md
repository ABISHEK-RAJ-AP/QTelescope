# PostgreSQL production path (IMP-P4)

## Quick start (Docker)

From repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --profile postgres up -d
```

Backend receives:

- `DATABASE_URL=postgresql+psycopg2://postgres:postgrespassword@db:5432/quantum_telemetry`
- `USE_ALEMBIC=true` (migrations on startup)

## Local API against Postgres (no Docker)

```bash
export DATABASE_URL=postgresql+psycopg2://postgres:postgrespassword@localhost:5432/quantum_telemetry
export USE_ALEMBIC=true
pip install psycopg2-binary  # if not already installed
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

On first boot, Alembic runs `upgrade head` (see `app/core/schema.py`).

## Users & audit

- Registered users: table **`user_accounts`** (migrated from `data/registered_users.json` when empty).
- Operator audit: **`audit_events`** table plus append-only `data/audit_events.jsonl`.
- Disable DB users (JSON only): `USE_DB_USERS=false`.

## Retention

- Policy: `GET /api/v1/admin/retention/policy`
- Manual purge (Admin): `POST /api/v1/admin/retention/run`
- Env: `TELEMETRY_RETENTION_DAYS` (default 90), optional `TELEMETRY_RETENTION_ON_STARTUP=true`

## Verify

```bash
curl -s http://localhost:8000/api/v1/admin/deployment/profile | jq .database_storage
# expect "postgresql" when using Postgres URL
```

See also [DATABASE_BACKUP.md](./DATABASE_BACKUP.md).
