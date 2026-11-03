# Q-TeleScope UI Redesign — Sprint 5 Report

**Date:** 2026-10-31  
**Scope:** Live telemetry, calibration status, drift analysis, historical trends, calibration timeline.

## 1. Summary

Telemetry tab pages now share Sprint 1 **chart theme**, **ChartPanel** empty/ready states, and **DataSourceBadge** honesty. Live SSE page surfaces `database_aggregate` messaging from the payload. Drift charts use **API timestamps** on the x-axis and show **drift_status**. Historical trends **dark-mode tooltips** fixed. Calibration status adds a **fleet table** plus summary counts.

## 2. Files modified

| File | Change |
|------|--------|
| `LiveTelemetry.jsx` | SSE honesty strip, cached badge, ChartPanel + theme |
| `CalibrationStatus.jsx` | Fleet table, counts, EmptyState, DataSourceBadge |
| `DriftAnalysis.jsx` | Theme, ChartPanel, drift_status, timestamp x-axis |
| `HistoricalTrends.jsx` | Theme tooltips, ChartPanel, EmptyState |
| `CalibrationTimeline.jsx` | Theme, ChartPanel, API note, empty paths |

## 3. Components reused

`ChartPanel`, `DataSourceBadge`, `EmptyState`, `baseTooltip`, `getChartTheme`, `useTheme`, `TelemetryWindowControl`.

## 4. APIs

| Page | Endpoints |
|------|-----------|
| Live | `GET /events/stream` (SSE) |
| Calibration status | `GET /backends`, `GET /calibration/{id}` |
| Drift | `GET /drift/{id}/qubits/{idx}?metric=&limit=` |
| Trends | `GET /backends/{id}/telemetry` |
| Cal timeline | `GET /calibration/{id}/timeline?limit=` |

## 5. Data gaps (unchanged)

- SSE is not vendor-live; label remains **cached / database aggregate**.
- Trends still per-backend (no fleet-wide availability series).
- Drift needs sufficient stored qubit samples in lookback window.

## 6. Tests

| Check | Result |
|-------|--------|
| pytest | **84 passed** |
| npm run build | **OK** |

## 7. Known issues

- Live telemetry still buffers last 40 ticks client-side only.
- Calibration timeline mark lines align to formatted x-axis labels (may miss if cal time off-sample).

---

**Stopped for review.** Next: **Sprint 6** — topology, anomalies, replay, jobs, queues.
