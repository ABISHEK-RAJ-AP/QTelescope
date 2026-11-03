# Q-TeleScope UI Redesign — Sprint 2 Report

**Date:** 2026-10-31  
**Scope:** Dashboard redesign (`DashboardHome.jsx`).

## 1. Summary

Replaced the single-chart dashboard with **three selectable layouts (A/B/C)**, widget toggles (localStorage), exception-first strip, severity-grouped alert triage, multiple **API-backed** charts via `ChartPanel`, compact fleet summary (inventory link — **removed** full backend duplicate table), coherence bar **click → backend details**, and honest labels (cached/simulated via provenance). **No** fleet availability time series (unsupported widget documented).

## 2. Files modified

| File | Change |
|------|--------|
| `frontend/src/pages/DashboardHome.jsx` | Full redesign |
| `frontend/src/pages/DashboardHome.css` | Layout/grid/styles |
| `frontend/src/utils/dashboardPreferences.js` | **New** — layout + widgets |
| `frontend/src/App.jsx` | Dashboard navigation callbacks |

## 3. Components reused

`ChartPanel`, `DataSourceBadge`, `EmptyState`, `getChartTheme`, `BoneyardSkeleton`.

## 4. API endpoints and fields

| Endpoint | Use |
|----------|-----|
| `GET /admin/summary` | Fleet KPIs, stale cal count |
| `GET /backends` | Fleet snapshot, queue chart labels |
| `GET /alerts?status=ACTIVE` | Triage groups |
| `GET /jobs` | Failed count in loaded set |
| `GET /queues` | Pending jobs per backend |
| `GET /calibration` | Freshness pie buckets |
| `GET /health/coherence` | T1/T2 bar chart + drill-down `backend_id` |
| `GET /operations/platform-health` | Exceptions strip, layout C panel |
| `GET /health/vector` | RED qubit sum |
| `GET /operations/centre` | Open incidents count |
| `GET /operations/timeline?limit=8` | Recent events list |
| `GET /jobs/analytics/failures` | Failure category bar (layout B) |
| `GET /admin/provenance` | DataSourceBadge kind |
| `GET /auth/config-status` | Mock flag |

## 5. Data gaps encountered

| Feature | Handling |
|---------|----------|
| Fleet availability over time | Widget `fleetTrend` disabled; explicit unsupported empty state if enabled |
| Dashboard global time range | Not added — list endpoints are point-in-time |
| KPI sparklines | Not implemented — no history API |

## 6. Screenshots

Not captured this sprint. Verify: layout selector A/B/C, exception strip clicks, coherence bar click, customize widgets.

## 7. Tests

| Check | Result |
|-------|--------|
| pytest | **84 passed** |
| `npm run build` | **OK** |

## 8. Known issues

- `GET /jobs` limit 50 — “failed jobs (loaded set)” label is intentional honesty.
- Layout grid pairs panels heuristically on wide screens — may stack oddly with many widgets off.
- Job failure chart depends on failed records existing in DB.

## 9. No fabrication

All numbers from API responses. Chart empty states when series empty. SSE/vendor-live not implied on coherence chart copy.

---

**Stopped for review.** Next: **Sprint 3** — Operations Centre, Platform Health, Resource Health.
