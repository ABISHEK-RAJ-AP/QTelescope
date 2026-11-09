# Metrics Explorer v1 (Release B / S5 start)

**Evidence date:** 2026-11-09

## Delivered

| Item | Location |
| --- | --- |
| Explorer UI | `/app/telemetry/explorer` — `MetricsExplorer.jsx` |
| Series | Pending jobs, wait time (telemetry); calibration age (snapshots) |
| Multi-backend | Optional compare overlay |
| Saved queries | `localStorage` via `metricsExplorerQueries.js` |
| Vitest | `metricsExplorerQueries.test.js` |
| E2E | `E26` in `telescope-journeys-ops.spec.ts` |

## Acceptance note

Release B **B4** (save/restore one query): covered by Vitest + E26 save path; restore verified manually via Load saved dropdown.

## Follow-ups

- Persist queries per user on server (`GET/PUT /metrics/saved-queries`)
- Registry-driven metric picker from `GET /metrics/registry`
- Time-compare (offset windows) per benchmark roadmap
