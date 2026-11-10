# Q-TeleScope shared component audit

## Inventory (primary)

| Component | Path | Used on | Styling | Known issues |
| --- | --- | --- | --- | --- |
| `EnterpriseDataTable` | `components/observability/EnterpriseDataTable.jsx` | Alerts, Ops timeline, Admin users, Platform health, Calibration status, Jobs, Incidents detail, Temporal replay | `enterpriseDataTable.css` + `custom-table` | Client-only pagination; no page-size; no “1–N of total” range; default `pageSize` 15 |
| `ListPager` | `components/observability/ListPager.jsx` | Calibration timeline (custom), scattered | `ListPager.css` | Minimal prev/next only |
| `ContextBar` | `components/observability/ContextBar.jsx` | Telemetry family | shell + observability | Time = hours presets, not datetime range |
| `TelemetryWindowControl` | `components/TelemetryWindowControl.jsx` | Scoped telemetry pages | inline + inputs | Custom = hours 1–720 only |
| `ChartPanel` | `components/observability/ChartPanel.jsx` | Most chart pages | observability.css | Small `chart-panel__question` |
| `PageRelatedNav` | `components/observability/PageRelatedNav.jsx` | Drift, Historical trends, modal footers | `page-related-nav` | Low adoption vs btn rows |
| `DetailDrawer` | `components/observability/DetailDrawer.jsx` | Alerts, queues, jobs | observability + size classes | Alert drawer many full-width secondary buttons |
| `InsightModal` | via `DetailModalLayout.jsx` | Qubit/resource health | `detail-drawer--xl` in density CSS | Structure varies by caller |
| `QtECharts` | `components/observability/QtECharts.jsx` | Charts | lazy echarts chunk | Theme font sizes still page-owned |
| `DataViewToolbar` / `SortableTh` | `DataViewToolbar.jsx` | Tables, calibration events | observability | OK pattern; not universal |
| `RefreshButton` | `components/ui/RefreshButton.jsx` | Page actions slot | ui | Good pattern |
| `BoneyardSkeleton` | `components/ui/Skeleton.jsx` | Loading routes | ui | — |
| `DependencyGraph` | `components/visualizations/topology/DependencyGraph.jsx` | Platform health | pipeline/topology css | Fixed in code; verify render |

## Duplicates / fragmentation

- **Pagination:** `EnterpriseDataTable` footer vs `ListPager` vs inline prev/next (Calibration timeline) vs none (Queue history flatMap).
- **Toolbars:** `page-toolbar-unified` vs `context-bar` vs `tm-toolbar` vs `DataPanelToolbar`.
- **Empty states:** `TableEmpty`, `ChartPanel` empty, page-local paragraphs.
- **Related links:** `fs-link` / `PageRelatedNav` vs multiple `btn-secondary` navigations.

## Suggested central fixes (Phase 2 — not implemented)

1. Extend `EnterpriseDataTable` with page-size selector + range label + optional server-side mode hook.
2. Mandate `ContextBar` OR `page-toolbar-unified` per page (lint or checklist).
3. `DetailDrawer` footer: link row component for cross-page navigation.
4. Chart typography defaults in `chartTheme.js`.
