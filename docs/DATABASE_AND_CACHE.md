# PostgreSQL, Redis, and performance

## Decision

- **PostgreSQL** — default primary DB (concurrency, indexes, ~97k+ telemetry rows).
- **Redis / Valkey** — optional cache (`REDIS_URL` or `VALKEY_URL`); app falls back to PostgreSQL if cache is down.
- **SQLite** — legacy/tests only; set `DATABASE_URL=sqlite:///./data/qtelescope.db` explicitly.

## Quick start (Docker)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Backend env (set in compose overlay):

- `DATABASE_URL=postgresql+psycopg2://postgres:postgrespassword@db:5432/quantum_telemetry`
- `REDIS_URL=redis://redis:6379/0`

## Migrate existing SQLite data

1. Start PostgreSQL and run migrations (`USE_ALEMBIC=true` on app startup, or `alembic upgrade head`).
2. Copy data:

```bash
export DATABASE_URL=postgresql+psycopg2://postgres:postgrespassword@localhost:5432/quantum_telemetry
python scripts/migrate_sqlite_to_postgres.py --sqlite sqlite:///./data/qtelescope.db
```

3. Point `.env` at PostgreSQL and restart the API.

## Host install (no Docker / no sudo)

This repo supports **user-space** Postgres + Redis via [Miniforge](https://github.com/conda-forge/miniforge) (already used on this machine):

```bash
# One-time (if Miniforge not installed)
curl -fsSL -o /tmp/Miniforge3.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh
bash /tmp/Miniforge3.sh -b -p "$HOME/miniforge3"

export PATH="$HOME/miniforge3/bin:$PATH"
./scripts/setup-local-infra.sh   # superuser postgres, password root (override POSTGRES_PASSWORD)

cp backend/.env.example .env
# Local .env uses: postgresql+psycopg2://postgres:root@localhost:5432/quantum_telemetry

alembic upgrade head
python scripts/migrate_sqlite_to_postgres.py --sqlite sqlite:///./data/qtelescope.db --fresh

./scripts/start-local-infra.sh   # after reboot
```

Data dirs (gitignored): `.pgdata/`, `.redis-data/`, `.backend.log`.

## Daily dev (no Docker)

```bash
export PATH="$HOME/miniforge3/bin:$PATH"
./scripts/dev-up.sh          # Postgres + Redis + API on :8000; verifies captcha + health vector
cd frontend && npm run dev   # :5173 → proxies /api to backend
```

**“Unable to load image challenge”** on login = API not on port **8000**. Run `./scripts/dev-up.sh` or `./scripts/run-backend.sh` (with infra up). Vite alone is not enough.

## Caching

| Key pattern              | TTL (default) | Invalidated on        |
| ------------------------ | ------------- | --------------------- |
| `qtelescope:health:vector` | 10s         | telemetry commit      |
| `qtelescope:alerts:summary` | 8s        | alert ack/resolve     |

Tune via `CACHE_TTL_HEALTH_VECTOR`, `CACHE_TTL_ALERTS_SUMMARY`, `CACHE_ENABLED=false`.

## API changes

- `GET /backends/status-all` — batch backend status (replaces N× `/backends/{id}/status`).
- `/health/vector` — bounded telemetry reads (no full-table scan).
- `/alerts/summary` — adds `critical_by_backend`, `warning_by_backend`.

## Rollback

Keep a SQLite backup before cutover. PostgreSQL writes after migration are not mirrored back to SQLite automatically.
