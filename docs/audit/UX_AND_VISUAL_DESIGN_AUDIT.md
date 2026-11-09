# UX and visual design audit

**Status:** In progress (2026-11-09)  
**Design target:** Enterprise observability — navy/charcoal dark, neutral light, restrained accent, **no global glass/neumorphism**.

## Token system

| Artefact | Path | Verdict |
| --- | --- | --- |
| Design tokens | `frontend/src/styles/design-tokens.css` | PASS — canonical CSS vars |
| Dark overrides | `frontend/index.css` `.dark` | **PARTIAL** — `--ds-status-*` wired in `.dark`; chart pages use tokens |
| Glass | `commandPalette.css`, modal backdrops | OK — overlay-only |

## Chart colors

**Helpers:** `chartTheme.js` — `getChartSemanticColors()`, `getFleetStateChartColors()`, `getModalityChartPalette()`, `getSeverityChartColors()`.

| Area | Status |
| --- | --- |
| Primary telemetry pages | **Migrated** (Dashboard, Queue, Live, Historical, Metrics, Drift, Alerts, Platform, Jobs, Calibration, Anomaly drawer, Ops timeline, Cal timeline, Temporal replay, Backend histogram) |
| Badge / table meta hex | **DONE** — token helpers in `chartTheme.js`; Job / Calibration / Anomaly pages |
| ECharts chrome (axis/tooltip) | `getChartTheme()` — fixed palette OK |

**Rule:** new charts use helpers above; no new raw hex in `pages/`.

## Layout patterns (verified)

| Pattern | Usage |
| --- | --- |
| `page-stack` + `card` | Most authenticated pages |
| `ChartPanel` | Telemetry — loading/empty/error honest |
| `EnterpriseDataTable` | Platform health, calibration, jobs, incidents, **alerts (ungrouped)** |
| `BoneyardSkeleton` | Initial load |
| `RefreshButton` | `PageActionsContext` |

## Responsive / density

| Area | Status |
| --- | --- |
| Sidebar collapse | App shell |
| Tables on mobile | PARTIAL — horizontal scroll; EDT sticky headers |
| Touch targets | btn--xs on dense tables — review WCAG 2.2 |

## Motion

`prefers-reduced-motion`: global guard in `index.css`; `A11yRuntimeEffects` skips cursor/motion overlays; `ChartExpandModal` closes on Escape — **PASS**.

## Density & operator UX

See [OPERATOR_CONSOLE_AND_DENSITY_AUDIT.md](OPERATOR_CONSOLE_AND_DENSITY_AUDIT.md) — Govern Overview pattern (KPI + one list, no bean grids).

## Next actions

1. ~~Chart token sweep~~ — `getChartSemanticColors()`.
2. Operator console queue redesign — **shipped** (single list + lane tabs).
3. Dashboard bento + Alerts EDT density — **DONE** (bento gap, alert panel + EDT pageSize 15).
4. 1024px viewport pass — **PARTIAL (2026-11-09)** — dashboard bento compact tiles span 6 cols at 900–1279px; shell rules in `App.css`. Manual screenshot pass still useful on `/app/alerts`, workspace tabs.
