# Q-TeleScope layout and alignment audit

**Method:** component/CSS review · **Rendered:** not fully verified (screenshots pending).

## Application shell

| Area | Finding | Source |
| --- | --- | --- |
| Sidebar width | Fixed nav column; collapsible behaviour in `App.jsx` / shell CSS | `index.css`, layout components |
| Main content | `.page-container` padding tightens at 1100px and 1366px | `index.css` media queries |
| Page header | Title + optional `PageActionsContext` slot | Shared head in shell |
| Density | `.page-toolbar-unified`, `.context-bar` standardised in `app-shell-density.css` | Partial adoption — many pages still use `tm-toolbar` or ad-hoc flex |

## Recurring layout defects

### 1. Fragmented toolbars (P1)

**Where:** `MetricsExplorer.jsx`, `BackendDetails.jsx`, `QueueMonitoring.jsx`, parts of telemetry module.  
**What:** Multiple horizontal bars (context + filters + actions) with different gaps/padding; controls `align-items` mixed (center vs flex-end).  
**Why:** Page-local CSS (`TelemetryPages.css`, `BackendDetails.css`) predates `page-toolbar-unified`.

### 2. Operator console list/grid (P1)

**Where:** `OperationsCentre.jsx` + `OperationsCentre.css`.  
**What:** Action queue mixes severity chips, long titles, and embedded error text; grid mode card heights uneven.  
**Why:** No shared `dvt-grid` density tokens; title string built inline (see TEXT/OPS-001).

### 3. Related navigation patterns (P2, improving)

**Where:** `PageRelatedNav.jsx`, `fs-link` rows on some telemetry pages vs **rows of `btn-secondary`** on Alerts drawer, QueueMonitoring, DeviceCapabilities.  
**Why:** Incomplete migration per `DESIGN.md`.

### 4. Topology / dependency graphs (P1)

**Where:** `DependencyGraph.jsx` (Platform health), topology pages.  
**What:** Recent ResizeObserver + toolbar fixes; still need runtime verify for clip/unused margin.  
**Evidence:** Code in repo; screenshot **BLOCKED**.

### 5. Device capabilities grids (P1)

**Where:** `DeviceCapabilities.jsx`.  
**What:** Capability cards + secondary buttons; alignment of metric labels reported uneven.  
**Status:** NEEDS_VERIFICATION in browser.

### 6. Incident cards (P1)

**Where:** `AlertsEvents.jsx`, `IncidentDetailPage.jsx`.  
**What:** Dense tables vs card grid toggle; many inline `btn-secondary` in cells.  
**Why:** Operational actions not consolidated into row menus.

## Grid / flex specifics

| Page | Issue |
| --- | --- |
| `DashboardHome` | Bento/KPI grids use `fo-grid*`; OK at desktop; verify 1024px stack |
| `PlatformHealth` | Operator sections trimmed; dependency graph section order changed in code — verify no orphan headings |
| `AdministrationPage` | RBAC matrix wide table; horizontal scroll expected; font size overrides in `app-shell-density.css` |

## Nested scrolling

Reported on long drawer bodies (`DetailDrawer`, queue drawer) and monospace log panels (`TelemetryPages.css` `.tm-log` max-height 340px). Intentional but can trap focus — see responsive/a11y doc.
