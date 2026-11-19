# Q-TeleScope performance & PostgreSQL / Timescale migration

## Root causes (measured)

| Issue | Symptom | Fix in repo |
| ----- | ------- | ----------- |
| Discovery on read paths | `/backends` 4–9s cache misses | `bootstrap_catalog_if_empty` only; scheduler + admin trigger (`c740e3b` + later) |
| Startup discovery + scheduler | Slow API boot | `STARTUP_HARDWARE_DISCOVERY=auto` skips when scheduler on |
| Frontend route `key={pathname}` | Full page remount every nav | Removed; `data-route` only |
| Login cache warm | 9 parallel heavy GETs | Critical warm first; `/reports/batch` idle-deferred |
| SQLite 431MB + 1.2M gate rows | Write lock, slow history | Postgres + optional Timescale |

## Discovery lifecycle (target)

- **Read APIs** (`/backends`, `/operations/centre`, …): read DB inventory only.
- **Scheduler** (`COLLECTION_SCHEDULER_ENABLED=true`): `collection_scheduler_loop` → `run_auto_discovery`.
- **Admin** `POST /admin/auto-discover` / run collection now.
- **Empty DB only**: `BOOTSTRAP_DISCOVERY_ON_EMPTY=true` (default) seeds once.
- **Status**: `GET /api/v1/operations/discovery-status` and `operations.centre` → `data_platform.discovery`.

Env:

```bash
COLLECTION_SCHEDULER_ENABLED=true
STARTUP_HARDWARE_DISCOVERY=auto   # skip startup poll when scheduler on
BOOTSTRAP_DISCOVERY_ON_EMPTY=true
```

## VM — stay on SQLite (fast path)

```bash
cd /path/to/QTelescope
git pull --ff-only origin main
./scripts/vm-demo-restart.sh
./scripts/performance-smoke.sh
```

## VM — migrate to PostgreSQL + TimescaleDB

Prerequisites: **either** Postgres already listening on `:5432` **or** Docker (user in `docker` group, or script uses `sudo docker`).

The migrate script:

1. Uses **existing Postgres on :5432** when `pg_isready` succeeds (creates `quantum_telemetry` DB if missing).
2. Otherwise starts Timescale in Docker on **:5433** (or next free port) — avoids `bind: address already in use` on 5432.

**Auto behaviour** (`vm-postgres-migrate.sh`):

1. Tries `.env` `DATABASE_URL` if already Postgres.
2. Tries `PG_PASS` / `PGPASSWORD` / `root` / `postgrespassword`.
3. If `:5432` is up but passwords fail: **`sudo -u postgres`** creates DB + sets lab password (`QTELESCOPE_DB_PASSWORD`, default `postgrespassword`). Disable with `QTELESCOPE_PG_AUTO_SETUP=0`.
4. Else **Docker Timescale on :5433+** (known `postgrespassword`).

**One-shot on VM:**

```bash
cd ~/QTelescope
git pull --ff-only origin main
chmod +x scripts/vm-postgres-autosetup.sh
./scripts/vm-postgres-autosetup.sh
```

Or step-by-step:

```bash
chmod +x scripts/vm-postgres-migrate.sh scripts/performance-smoke.sh
./scripts/vm-postgres-migrate.sh
./scripts/vm-demo-restart.sh
./scripts/performance-smoke.sh
```

Skip broken system Postgres and force Docker only:

```bash
TIMESCALE_PREFER_DOCKER=1 ./scripts/vm-postgres-migrate.sh
```

Manual equivalent:

```bash
docker compose -f docker-compose.timescale.yml --profile timescale up -d
export DATABASE_URL=postgresql+psycopg2://postgres:postgrespassword@127.0.0.1:5432/quantum_telemetry
export USE_ALEMBIC=true PYTHONPATH=.
alembic upgrade head
python scripts/migrate_sqlite_to_postgres.py --sqlite sqlite:///./data/qtelescope.db
python scripts/init_timescale_hypertables.py
```

Original SQLite file is **not** deleted. Roll back by setting `DATABASE_URL=sqlite:///./data/qtelescope.db` in `.env` and restarting API.

## Timescale retention (next phase)

Hypertables are created by `scripts/init_timescale_hypertables.py`. Retention/compression policies are **not** enabled by default — configure via admin retention or a future migration when governance approves drop windows.

See also [DATABASE_POSTGRES.md](../DATABASE_POSTGRES.md), [DATABASE_BACKUP.md](../DATABASE_BACKUP.md).

## Acceptance targets (measure with `performance-smoke.sh`)

| Endpoint | Target |
| -------- | ------ |
| Cached `/backends` | < 100 ms |
| `/operations/centre` (cached) | < 200 ms |
| `/health/vector` (cached) | < 300 ms |
| Discovery on GET catalogue | **never** |