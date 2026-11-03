# Database & Migrations

## Defaults

| Mode | `DATABASE_URL` | Schema apply |
|------|----------------|--------------|
| Local dev | `sqlite:///./data/qtelescope.db` | Alembic `head` on startup (or `create_all` if Alembic missing) |
| Docker SQLite | same via volume mount | `USE_ALEMBIC=true` |
| Docker PostgreSQL | see below | Alembic on startup |

Set `USE_ALEMBIC=false` to force SQLAlchemy `create_all` (quick tests only).

## Migrations (CLI)

From repository root (with venv + `pip install -r backend/requirements.txt`):

```bash
export DATABASE_URL=sqlite:///./data/qtelescope.db
alembic upgrade head
alembic revision --autogenerate -m "describe change"
```

PostgreSQL example:

```bash
export DATABASE_URL=postgresql+psycopg2://postgres:postgrespassword@localhost:5432/quantum_telemetry
alembic upgrade head
```

## Docker PostgreSQL stack

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --profile postgres up -d --build
```

Backend waits for `pg_isready`, then runs migrations on boot.

## Backup / restore (PostgreSQL smoke)

```bash
docker exec quantum_postgres pg_dump -U postgres quantum_telemetry > backup.sql
cat backup.sql | docker exec -i quantum_postgres psql -U postgres -d quantum_telemetry
```

## SQLite file backup

Copy `data/qtelescope.db` while the API is stopped.
