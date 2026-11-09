# Reports and exports audit

**Status:** Initial pass (2026-11-09)  
**UI:** `frontend/src/pages/ReportsPage.jsx`  
**API:** `GET /api/v1/reports/export`, bundle export/import

## Formats offered

| Format | Scope | Behaviour | E2E |
| --- | --- | --- | --- |
| CSV | Fleet + per-backend | Client-built from JSON records; RFC4180-style escaping | E15 ✅ |
| JSON | Fleet + per-backend | Wrapped `{ kind, scope, exported_at, records }` | — |
| HTML | Fleet-wide only | Server `exportReport(type, 'html')` | Partial |
| Bundle JSON | Full bundle | `api.exportBundle()` → download | Manual |

## Verified

- Empty export throws **"No records for this scope — nothing to export."** (no empty file silently).
- CSV formula-injection: `csvExport.js` prefixes `=+-@` cells — **fixed** + Vitest.
- Filename pattern: `{type}_{scope}_{timestamp}.{ext}`

## Gaps (P2)

| ID | Issue |
| --- | --- |
| R-01 | No PDF report layout (programme Phase 12) |
| R-02 | CSV injection guard | **Fixed** `lib/csvExport.js` |
| R-02b | No XLSX with typed columns |
| R-03 | HTML export branding/metadata not audited |
| R-04 | Evidence manifest column stability — verify against OpenAPI schema |

## Permissions

Exports use authenticated `fetchApi` / `api.exportReport` — backend must enforce RBAC (**NEEDS_VERIFICATION** in security pass).
