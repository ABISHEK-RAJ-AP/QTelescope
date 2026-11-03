# Q-TeleScope UI Redesign — Sprint 1 Report

**Date:** 2026-10-31  
**Scope:** Design system + application shell (no full page redesigns).

## 1. Summary

Added shared observability components, route-aware `PageHeader`, compact/comfortable density (localStorage), severity-aware alert sidebar badge, mobile nav drawer, shared ECharts theme helper, and dark-mode table hover fix. Existing routes and APIs unchanged.

## 2. Files modified

| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Shell: PageHeader, density, mobile menu, alert critical count |
| `frontend/src/index.css` | Import observability CSS; table hover token; mobile title |
| `frontend/src/services/api.js` | Remove duplicate `getFederationStatus` key |
| `frontend/src/utils/uiPreferences.js` | **New** — density preference |
| `frontend/src/utils/pageContext.js` | **New** — breadcrumbs/titles per route |
| `frontend/src/components/observability/*` | **New** — shared UI kit |

## 3. Components added

- `PageHeader`, `InfoTooltip`, `DataSourceBadge`, `ChartPanel`, `DetailDrawer`, `EmptyState`, `ErrorState`, `TimeRangeSelector`, `chartTheme.js`, `observability.css`, `index.js` barrel.

**Reused:** `TelemetryWindowControl`, `DataProvenanceBar`, `BoneyardSkeleton`, `ThemeProvider`.

## 4. API endpoints used (Sprint 1)

- `GET /alerts?status=ACTIVE` — total + client-side `CRITICAL` count for sidebar badge.

No new endpoints.

## 5. Data gaps

- None introduced. ChartPanel/EmptyState not yet wired on pages (Sprint 2+).
- Dashboard time range still N/A (unchanged).

## 6. Screenshots

Not re-captured this sprint. Verify manually: `/app` breadcrumbs, compact toggle, mobile menu ≤768px, alerts badge `N crit` when critical alerts exist.

## 7. Tests

| Check | Result |
|-------|--------|
| `USE_ALEMBIC=false PYTHONPATH=. pytest tests/` | **84 passed** |
| `cd frontend && npm run build` | **OK** |

## 8. Known issues

- Telemetry tab bar still 10 tabs (overflow scroll) — grouping deferred.
- `PageHeader` h1 + page content may still use h3 headings — per-page cleanup in later sprints.
- Admin modal focus trap still open (Sprint 8).
- axe not run yet (Sprint 9).

## 9. Fabrication / scope confirmation

No fabricated metrics, charts, or endpoints. No circuit submission. Shared components only; page bodies unchanged except shell wrapper.

---

**Stopped for review.** Next: **Sprint 2 — Dashboard redesign** (`DashboardHome.jsx`, layouts A/B/C, `ChartPanel` adoption).
