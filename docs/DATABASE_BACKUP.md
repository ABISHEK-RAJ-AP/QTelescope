# Backup & restore (IMP-P4)

## SQLite (default dev)

```bash
./scripts/backup_sqlite.sh
```

Creates `backups/qtelescope_data_<timestamp>.tar.gz` including `data/` (DB file, jsonl, evidence).

Restore: stop API, extract tarball over `data/`, restart.

## PostgreSQL

```bash
export DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/quantum_telemetry
./scripts/backup_postgres.sh
```

Produces `backups/pg_quantum_telemetry_<timestamp>.sql.gz`.

Restore (empty database):

```bash
gunzip -c backups/pg_quantum_telemetry_*.sql.gz | psql "$DATABASE_URL"
```

## DR drill (minimal)

1. Run backup script.
2. Copy tarball/SQL to secondary path.
3. On clean host: restore + `USE_ALEMBIC=true` + start API.
4. Confirm `GET /api/v1/health/coherence` and login.
