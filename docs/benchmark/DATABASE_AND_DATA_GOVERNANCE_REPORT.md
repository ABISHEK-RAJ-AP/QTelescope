# Database & data governance gap report

**Date:** 2026-11-09

## Inventory

| Item | Evidence |
| --- | --- |
| ORM models | `app/models/entities.py`, `development.py` |
| Migrations | `alembic/versions/` (15 files) |
| Incidents | `20261031_0002_incidents.py` |
| Evidence snapshots | `20261031_0003_evidence_snapshots.py` |
| Perf indexes | `20261102_0005_perf_indexes.py` |
| Inventory lifecycle | `20261103_0013_inventory_lifecycle.py` |
| Lab CI | SQLite; prod target Postgres per `.env.production.example` |

## Checklist alignment (master)

| ID | Topic | Status |
| --- | --- | --- |
| D02 | Alembic | PARTIAL — migrations exist; CI SQLite |
| D04 | Time-series indexes | PARTIAL — perf migration |
| D05 | Retention/archival | **FAIL** |
| D07–D08 | History / provenance | PARTIAL — `provenance_json`, soft patterns vary |
| D09–D10 | Quality / stale enums | **FAIL** — not end-to-end in UI |
| D11 | Calibration revisions | PARTIAL — snapshots |
| D12 | Audit immutability | PARTIAL — `audit_events` |

## Conceptual schema additions (prioritized)

Use only when no clean extension of existing tables:

| Table / concept | Purpose | Release |
| --- | --- | --- |
| `collector_executions` | B07 collector history | B |
| `telemetry_quality_reports` | Ingest QA | B |
| `slo_definitions`, `slo_measurements` | Reliability | B |
| `resource_registry`, `resource_ownership` | Datadog catalogue | B |
| `platform_events`, `event_outbox` | Reliable events | C |
| `change_requests`, `configuration_versions` | Governance | C |
| `notification_routes`, `notification_deliveries` | Escalation | C |
| `calibration_revisions`, `benchmark_runs` | IBM depth | D |
| `data_retention_policies` | D05 closure | C |

**Rule:** Extend `backends`, `calibration_snapshots`, `audit_events` before parallel models.

## Governance actions (S6)

- Backup restore drill with evidence row in QA report.  
- Migration review gate in CI (`USE_ALEMBIC=true` job).  
- Retention policy engine (even if v1 = cron + archive zip).
