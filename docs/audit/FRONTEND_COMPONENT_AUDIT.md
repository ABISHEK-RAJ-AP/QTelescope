# Frontend component audit

**Status:** Initial pass (2026-11-09)  
**Scope:** `frontend/src/components/` — excludes QRP, `qniverse/`, `apps/govern/`.

## Layer map

| Layer | Path | Role |
| --- | --- | --- |
| Observability kit | `components/observability/` | Tables, charts, empty/error, drawers, modals |
| Shell | `components/shell/` | Palette, a11y, keyboard |
| UI primitives | `components/ui/` | Button, skeleton, theme, toast, refresh |
| Dashboard | `components/dashboard/` | Bento grid |
| Admin | `components/admin/` | Role matrix |
| Marketing / auth chrome | `components/marketing/`, `AuthShell.jsx` | Public surfaces only |
| Onboarding | `components/onboarding/` | Product tour |

## High-leverage components (verified usage)

| Component | Tests | Notes |
| --- | --- | --- |
| `EnterpriseDataTable.jsx` | Vitest ✅ | `onRowClick`; used on Platform Health, Calibration, Jobs, Incidents, Alerts (ungrouped) |
| `EmptyState.jsx` / `ErrorState.jsx` | — | Copy from `constants/messages.js` |
| `ChartPanel.jsx` | — | Honest loading / empty / error |
| `chartTheme.js` | — | `getChartSemanticColors()` on primary telemetry charts |
| `QtECharts.jsx` | — | Resize + theme hook |
| `CommandPalette.jsx` | E2E journeys | Workflow audit W-002 |
| `ConfirmDialog.jsx` | E10 | Ack / destructive flows |

## Gaps

| ID | Item | Severity |
| --- | --- | --- |
| FC-01 | No storybook / visual regression harness | P2 |
| FC-02 | Chart series hex | **Closed** (2026-11-09 token sweep); badge meta hex remains |
| FC-03 | Shared badge colors (`opsShared`, `STATUS_META`) not tokenized | P2 — **PARTIAL**: `CalibrationStatus` KPI accents → `--ds-status-*` |
| FC-04 | Component-level a11y (focus trap in drawers) — **PASS** | P1→DONE |
| FC-05 | `index.js` barrel in observability — partial exports only | P3 |

## Conventions (keep)

- Page data fetching lives in `pages/`; components stay presentational where possible.
- `data-tour` on page regions for onboarding — not inside leaf widgets.
- CSS: page styles co-located (`TelemetryPages.css`, etc.); tokens in `design-tokens.css`.

## Next

1. Tokenize `SevBadge` / job status colors via CSS vars.
2. Add focused Vitest for `ChartPanel` error branch.
3. Pair with [ACCESSIBILITY_AND_RESPONSIVENESS.md](ACCESSIBILITY_AND_RESPONSIVENESS.md) (planned).
