# Resource catalogue v1 (Release B)

**Evidence date:** 2026-11-09

## Shipped

| Layer | Detail |
| --- | --- |
| Store | `data/backend_catalog.json` via `app/services/backend_catalog.py` |
| API | `GET /backends` enriched with `owner`, `facility`, `tags`; `PATCH /admin/backends/{id}/catalog` |
| UI | Backend inventory columns + admin catalogue modal |
| Tests | `tests/test_backend_catalog.py` |

Default **facility** falls back to provider label when unset (visible, overridable).

## Acceptance

Release B **B5** (owner + facility on resource row): met for fleet inventory.

## Follow-ups

- Alembic `backends` columns or link to governance `inventory_assets`
- Collector/provider owner in admin integrations
- Escalation policy tied to owner
