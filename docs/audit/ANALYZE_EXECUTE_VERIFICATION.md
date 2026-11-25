# Analyze & Execute remediation — verification log

**Date:** 2026-11-25  
**Scope:** Operator console Analyze/Execute surfaces, alerts/incidents/metrics wave from prior prompts.

## Automated checks (this session)

| Check | Result |
| --- | --- |
| `frontend npm run build` | PASS |
| Vitest `alertSemantics`, `formatCalibrationAge` | PASS (6 tests) |
| Pytest targeted suite (incidents, replay, anomaly scope, alerts recovery, metrics export/registry, drift) | PASS after anomaly test DB isolation fix |

## Implemented vs audit prompts

| Area | Status | Evidence |
| --- | --- | --- |
| Calibration status (static cards, age semantics) | Done | `CalibrationStatus.jsx`, `formatCalibrationAge.js` + tests |
| Calibration timeline (ticks, timestamps, chart height) | Done | `CalibrationTimeline.jsx` |
| Historical trends (window limit, chart ticks, pending step) | Done | `HistoricalTrends.jsx`, `telemetryWindow.js` |
| Drift (scope title, units, linear series) | Done | `DriftAnalysis.jsx` |
| Live telemetry (table refresh, chart scope) | Done | `LiveTelemetry.jsx` |
| Metrics explorer (limit, ticks, stats, saved-query UX) | Done | `MetricsExplorer.jsx` |
| Temporal replay (newest frames API, labels, latest jump, stale copy) | Done | `temporal_replay.py`, `TemporalReplay.jsx`, tests |
| Anomaly monitor (backend scope) | Done | `anomaly_scan.py`, `AnomalyMonitor.jsx`, tests |
| Job monitoring (single search toolbar) | Done | `JobMonitoring.jsx` |
| Alerts/incidents (units, dedupe, resolve gate, search) | Done | `alert_engine.py`, `IncidentDetailPage.jsx`, tests |
| Metrics coverage (groups, CSV export) | Done | `registry.py`, `coverage_export.py`, tests |
| Design tokens / skip link | Done | `design-tokens.css`, `a11y-shell.css` |
| Backend workspace / coupling preview | Done | `BackendDetails.jsx`, `CouplingGraphPreview.jsx` |

## Explicitly deferred (not in this commit)

| Item | Reason |
| --- | --- |
| Topology explorer visual redesign | User requested leave as-is |
| Formal §16 audit pack (screenshots, deployment HTTPS doc) | Documentation deliverable, not code |
| Passkeys / full security audit / fleet-wide status model | Out of prior implementation scope |
| Browser E2E screenshot pass | Requires live demo + manual capture |
| Alerts calendar/list-first redesign (P2) | Not in completed file set |

## Shippable statement

All **code** items listed in the implemented table are present in the working tree, build green, and covered by the automated checks above. Deferred rows remain product/audit follow-ups, not partial skips inside the implemented modules.