# Q-TeleScope — Shared Component Plan

**Baseline (verified in repo):** React 19, Vite 8, React Router 7, CSS variables in `index.css`, Tailwind import, ECharts, `@dnd-kit` for dashboard layout.

## Existing shared components (keep / extend)

| Component | Path | Role | Action |
| --------- | ---- | ---- | ------ |
| PageHeader | `observability/PageHeader.jsx` | Title, breadcrumbs, backend code | Extend: subtitle, context slot |
| DataProvenanceBar | `DataProvenanceBar.jsx` | Platform DB line | Extend: optional panel-level `ProvenanceChip` |
| RefreshButton | `ui/RefreshButton.jsx` | Icon refresh + last load in title | Keep |
| ChartPanel | `observability/ChartPanel.jsx` | Chart + empty/error | Keep; wire provenance chip |
| EmptyState / ErrorState / TableEmpty | `observability/EmptyState.jsx` | States | Add **StaleState**, **UnsupportedState**, **PartialDataBanner** |
| InfoTooltip | `observability/InfoTooltip.jsx` | Metric help | Expand glossary linkage |
| healthGlossary | `observability/healthGlossary.js` | Health metrics | Use on Resource Health + workspace |
| TimeRangeSelector | `observability/TimeRangeSelector.jsx` | Window | **Wire to URL** `from`/`to` |
| TelemetryWindowControl | `TelemetryWindowControl.jsx` | Window hours | Consolidate with TimeRangeSelector |
| BoneyardSkeleton | `ui/Skeleton.jsx` | Loading | Keep layouts per page type |
| LayoutCustomizeToggle + DashboardBentoGrid | dashboard/* | Overview customize | Keep for Fleet Overview only |
| ThemeProvider | `ui/ThemeProvider.jsx` | Light/dark | Keep |
| A11yPreheader + A11yPanel | `shell/*` | Skip + prefs | Keep |

## New shared components (P0–P1)

### 1. `ContextBar` (P0)

**Purpose:** Answer “what scope am I viewing?”

**Props:** `backendId`, `onBackendChange`, `timeRange`, `onTimeRangeChange`, `metric`, optional `alertId`, `incidentId`, `readOnly`.

**Behavior:** Reads/writes URL search params via React Router; lists backends from cached `getBackends()` or context provider.

**Used on:** Analyze/*, Investigate/*, Execute filters, Workspace shell.

### 2. `ProvenanceChip` (P0)

**Purpose:** Compact trust without badge soup.

**Values:** `provider` | `stored` | `derived` | `advisory` | `imported` | `cached` | `stale` | `partial` | `unsupported`

**UI:** 1 line + expand to `getProvenance()` slice or panel metadata.

**Rules:** Never show `simulated` in chrome (`DataSourceBadge` already null for simulated — extend pattern).

### 3. `ExceptionStrip` (P0)

**Purpose:** Single reusable **severity-first** strip (not 5 equal KPI cards).

**Props:** items `{ label, value, severity, href, sourceHint }`

**Replaces:** duplicated `.dashboard-exception-stat` in Dashboard + OperationsCentre.

**Data contract:** Parent passes **pre-documented** metrics only (critical count from ACTIVE+CRITICAL, active total from `/operations/centre` or `/alerts?status=ACTIVE`).

### 4. `WorkspaceTabNav` (P0)

**Purpose:** URL-synced tabs for backend workspace.

**Tabs:** summary | telemetry | qubits | calibration | jobs | queues | health | topology

**Routes:** `/app/fleet/:backendId/:tab`

### 5. `FleetSummaryBand` (P1)

**Purpose:** Provider/modality/status counts above registry table.

**Data:** `getBackends()` + optional `getAdapterVerification()`.

### 6. `InvestigationLink` (P1)

**Purpose:** Standard link button with preserved query string.

**Helpers:** `buildInvestigationUrl({ alert, backendId, incidentId })`

### 7. `ConfigureSectionLayout` (P0)

**Purpose:** Shared layout for split admin pages (title, description, actions, card sections).

### 8. `EdgeTable` (P2)

**Purpose:** Accessible alternative for Topology graph.

**Data:** same as `getBackendTopology` links/nodes.

## Design tokens (validate / codify in `index.css`)

| Token | Current | Target |
| ----- | ------- | ------ |
| Page title | PageHeader | 20–22px semibold |
| Section | `.page-section-title` | 14px bold |
| KPI | `.card-value` | 20–24px tabular nums |
| Table | `.custom-table` | 12–13px; compact class |
| Spacing unit | ad hoc | 4px grid; `.page-stack` gap 12px |
| Status colors | badge-* classes | Document semantic map; no decorative use |

## Density modes (P1)

- Class `.density-compact` on `.page-container`: tighter table padding, smaller chart min-heights.
- Persist in `localStorage` alongside a11y prefs.

## Accessibility (shared)

- All new components: keyboard focus, `aria-label`, status not color-only (icon + text).
- Chart panels: require `tableAlternative` or `EdgeTable` for graph pages.
- Live region for SSE connect/disconnect on Live Telemetry.

## Files to touch (implementation phase — not now)

| Area | Files |
| ---- | ----- |
| Context | New `context/InvestigationContext.jsx` or URL-only (prefer URL) |
| Nav | `appNav.js`, `App.jsx`, `pageContext.js` |
| Export barrel | `observability/index.js` |
| CSS | `index.css`, `observability.css` |

## Anti-patterns to remove during implementation

- Inline theme colors in pages (e.g. `JobMonitoring.jsx` hardcoded `#0f172a`).
- Second timestamp clocks beside `RefreshButton`.
- Duplicate Metrics Coverage mount in `App.jsx` resources + telemetry tabs.
