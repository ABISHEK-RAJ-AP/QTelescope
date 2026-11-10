# Q-TeleScope frontend repair backlog

| ID | Priority | Route | Component | Source file | Screenshot | Current state | Defect | Root cause | Expected state | Proposed fix | Dependencies | Risk | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UI-001 | P0 | `/app/operate` | Queue item title | `OperationsCentre.jsx`, `utils/operatorFault.js` | — | Sanitised title | Raw errors in title | `p.error` in string | Safe summary | `summarizeOperatorError` | — | Low | `operatorFault.test.js` | FIXED |
| UI-002 | P0 | Global | Tables + ops floor | `design-tokens.css`, `typography-ops-floor.css`, Dashboard `fo-*` | done | Table 1rem; main-content floor | 12/13px vs shell | Legacy page CSS | ≥14px html min; helper 14px | CSS vars | — | Medium | Re-capture overview alerts panel | DONE |
| UI-003 | P1 | `/app/execution/queues` | History table | `QueueMonitoring.jsx` | `queue-monitoring-desktop-light.png` | 25-row pager | Was unbounded | flatMap | Bounded view | ListPager | — | Low | Visual | FIXED |
| UI-004 | P1 | Telemetry module | Time controls | `telemetryWindow.js` | — | Label “Custom hours” | Mislabeled range | Copy | Accurate hours UX | Rename option; datetime still blocked on API | Backend | — | BLOCKED (API) | IN_PROGRESS |
| UI-005 | P1 | `/app/alerts` | Alert drawer footer | `AlertsEvents.jsx` ~1029+ | done | `PageRelatedLink` in drawer; primary workspace in Respond | Blog-like nav strip | Pre-PageRelatedNav pattern | `page-related-nav` links | Replace btn-secondary nav | `PageRelatedNav.jsx` | Low | Drawer screenshot | DONE |
| UI-006 | P1 | Multiple | Pagination | `EnterpriseDataTable.jsx` | pending | Range + page size + first/last | Was minimal | Footer design | Full pager chrome | Extended footer | `useTableKit` | Low | Unit test added | FIXED |
| UI-007 | P1 | `/app/alerts` | Alert table | `AlertsEvents.jsx` | pending | Client paginate on full fetch | Scale / perf | No server paging in UI | Server page params or cursor | API + EDT mode | Backend | API contract | Load test | OPEN |
| UI-008 | P1 | `/app/backends/details/*` | Toolbars | `BackendDetails.jsx`, css | pending | Fragmented metric controls | Misaligned filters | Local CSS | Single `page-toolbar-unified` | Refactor toolbar row | ContextBar | Medium | Screenshot | OPEN |
| UI-009 | P1 | `/app/telemetry/topology` | Graph layout | `TopologyExplorer.jsx` + graph css | pending | Unused margin / icon align (reported) | Visual maturity | Layout constants | Fit container + toolbar | ResizeObserver pattern like DependencyGraph | Shared graph toolbar | Medium | Visual | NEEDS_VERIFICATION |
| UI-010 | P1 | Resource health | Qubit modal | `ResourceHealth.jsx`, `InsightModal` | pending | Cramped sections (reported) | Layout variants | Caller-specific JSX | xl modal + metric grid | Standard detail sections | `topo-metric-grid` | Low | Modal screenshot | NEEDS_VERIFICATION |
| UI-011 | P1 | `/app/platform/health` | Main page | `PlatformHealth.jsx` | pending | Trimmed operator view | Was cluttered (SLI/probes) | Partial fix landed | Operator-only sections | Verify no impl details left | — | Low | Content review | NEEDS_VERIFICATION |
| UI-012 | P1 | `/app/admin/users` | RBAC matrix | `AdministrationPage.jsx` | pending | Hard to read matrix | Small type + wide grid | Custom matrix CSS | Sticky header + larger type | Matrix-specific tokens | — | Low | a11y contrast | OPEN |
| UI-013 | P1 | Global | Page titles | `index.css`, `observability.css` | pending | `--font-size-page-title`; no 1366 shrink | Was 15px shrink | Media query | Stable title scale | Tokens + removed rule | — | Low | Computed style | FIXED |
| UI-014 | P2 | Global | Related nav migration | many pages | partial | Drawers + footer nav migrated; grid `btn--xs` investigate rows remain | Inconsistent chrome | Incremental migration | DESIGN.md link row | Grep `btn-secondary` nav | PageRelatedNav | Low | Page checklist | IN_PROGRESS |
| UI-015 | P2 | Dark theme | Tables | `index.css` | pending | `var(--bg-card-hover)` th | Was `#f8fafc` | Hardcoded | Theme tokens | CSS vars | — | Low | Dark screenshot | FIXED |
| UI-016 | P2 | Charts | Axis labels | `chartTheme.js` | pending | Legend 11px min | Was 9–10 | polishChartOption | ≥11px | chartTheme | — | Low | Chart screenshot | IN_PROGRESS |
| UI-017 | P2 | `/app/resources/capabilities` | Grid | `DeviceCapabilities.jsx` | pending | Poor alignment (reported) | Local grid | NEEDS_VERIFICATION | CSS grid tokens | — | — | Visual | NEEDS_VERIFICATION |
| UI-018 | P2 | Incidents | Cards | `AlertsEvents.jsx` | pending | Busy incident cards | Many inline actions | No row menu pattern | Context menu component | — | Medium | UX review | OPEN |
| UI-019 | P3 | Global | `chart-panel__question` | `ChartPanel.jsx`, observability.css | pending | Small didactic text | Tone + size | Component design | Shorter provenance | Copy pass | TXT inventory | Low | — | OPEN |
| UI-020 | P1 | Performance | Initial load | `QtECharts`, router | pending | Felt slow (reported) | Shell + API | Lazy echarts done | Measure LCP | Lighthouse | PERF doc | — | Lighthouse | OPEN |
| UI-021 | P1 | Admin / modals | Advisory detail | Admin + alerts modals | pending | Narrow modal (reported) | size prop | NEEDS_VERIFICATION | `size="xl"` everywhere | Audit all InsightModal calls | DetailModalLayout | Low | Modal width measure | NEEDS_VERIFICATION |
| UI-022 | P1 | Edit flows | Various | Admin, incidents | pending | Inline edit vs modal | Inconsistent | No standard | Modal edit pattern | Shared FormModal | forms | Medium | Workflow test | OPEN |

## Known-issue checklist (§15)

| # | Reported issue | Result |
| --- | --- | --- |
| 1 | Typography too small | **CONFIRMED** (tables/titles/chart labels) — partial density fix in shell |
| 2 | Header/content alignment poor | **PARTIAL** — unified toolbar not universal |
| 3 | Grid overlap / uneven spacing | **NEEDS_VERIFICATION** |
| 4 | Unnecessary related-page buttons | **CONFIRMED** on Alerts/Queue; partial `PageRelatedNav` |
| 5 | Custom date range broken | **MISALIGNED EXPECTATION** — hours only, no datetime UI |
| 6 | Many tables no pagination | **CONFIRMED** queue history; others use EDT |
| 7 | Calibration events no pagination | **FIXED** client pager 25/page (`CalibrationTimeline.jsx`) |
| 8 | Queue history no pagination | **CONFIRMED OPEN** |
| 9 | Operator console grid poor | **PARTIAL** — layout + error text issue |
| 10 | Backend metric controls fragmented | **CONFIRMED** |
| 11 | Qubit modal structure | **NEEDS_VERIFICATION** |
| 12 | Topology unused space | **NEEDS_VERIFICATION** |
| 13 | Advisory modal narrow | **NEEDS_VERIFICATION** |
| 14 | Dependency graph clipped | **MITIGATED IN CODE** — verify render |
| 15 | Platform health unnecessary sections | **PARTIALLY REMOVED** |
| 16 | Platform health impl details | **PARTIALLY REMOVED** — verify |
| 17 | Device capabilities grid | **NEEDS_VERIFICATION** |
| 18 | Incident cards structure | **CONFIRMED busy** |
| 19 | Role matrix readability | **CONFIRMED** |
| 20 | Edit modals | **PARTIAL** |
| 21 | Raw SQL in UI | **CONFIRMED** OperationsCentre |
| 22 | Generic/dev text | **PARTIAL** — inventory started |
| 23 | Slow loading | **PARTIAL** — echarts lazy; LCP not measured |
