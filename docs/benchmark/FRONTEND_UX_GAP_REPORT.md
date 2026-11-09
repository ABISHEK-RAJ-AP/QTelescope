# Frontend & UX gap report

**Date:** 2026-11-09 · Evidence: [SPRINT2_ROUTE_AUDIT.md](../QA/SPRINT2_ROUTE_AUDIT.md)

## Strengths

- **Auth shell** with captcha/MFA flows (`LoginPage`, `AuthShell`, `CaptchaField`).
- **Operational density** on fleet pages: inventory cards/table, operator console, platform health.
- **Shared observability primitives:** `ErrorState`, `EmptyState`, `BoneyardSkeleton`, `PageHeader`, `CommandPalette`, `DetailDrawer`.
- **Investigation linking:** `investigationLinks.js`, dashboard → backend details.
- **Tour hooks:** `data-tour` on KPI, inventory, admin regions (Playwright E01–E24).
- **Design tokens:** `design-tokens.css` + global `index.css`.

## Gaps vs enterprise consoles

| Area | Current | Target (borrowed pattern) | Routes / components |
| --- | --- | --- | --- |
| Application shell | Sidebar groups, collapse | + facility selector, global time range, notif bell | `App.jsx` shell |
| Global search | Ctrl+K **navigation only** | Resource + incident + metric search | `CommandPalette.jsx` |
| Tables | Mixed patterns; `EnterpriseDataTable` on Platform Health | One grid: filters, saved views, bulk | All table-heavy pages |
| Forms | `Field` + partial `AppFormField` | Unified validation + `htmlFor` everywhere | Admin, settings, register |
| Charts | ECharts per page | Shared `TimeSeriesChart` + annotations | Telemetry, drift, trends |
| Status language | Multiple labels (ONLINE, Operational, …) | Central status dictionary + badges | `backendCommon.jsx` |
| Drawers | Modal-style `DetailDrawer` | Quick inspect + “open full page” | Jobs, alerts, backends |
| Help | Product tour, tooltips sparse | Page help + metric glossary | All major routes |
| Responsive | Not verified 9 viewports | Matrix in QA | T06 |
| a11y | Partial labels (login fixed 2026-11-09) | axe audit + keyboard charts | T07 |

## Page-specific enhancements (priority)

| Page | P1 enhancements |
| --- | --- |
| Dashboard | Widget library, compare period |
| Inventory | Saved views, resource tags, groups |
| Backend details | Revision diff tab, annotation on charts |
| Alerts | Correlation panel, log drill-down CTA |
| Incidents | Investigation workspace layout |
| Platform health | Dependency mini-map |
| Reports | Report builder preview |
| Admin | Collector execution timeline (B07) |

## Sprint mapping

- **S4:** Notification centre UI shell, shift handover, status dictionary.  
- **S5:** Chart kit + annotations.  
- **S6:** Visual regression + a11y pass.
