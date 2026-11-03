# Q-TeleScope Product Rescue: sprint plan

Sprints 1-5 (shell, tokens, shared components, charts on telemetry pages) are already in the repo. This plan covers what is left, one page per sprint, in order of operator pain.

## Rules for every sprint

1. Audit the page first: open the route, screenshot, list defects, list the API fields it already returns (`curl localhost:5173/api/v1/...`).
2. Pick visuals only where a field answers a real question. No chart without data behind it. No 3D unless the data has physical geometry (topology of a real chip layout is the only candidate).
3. Every metric shows source, unit, timestamp. Imported, seeded, derived and advisory data are labelled (`ChartPanel` `sourceKind`, `ProvenanceChip`).
4. Small things become drawers or modals (`DetailDrawer`), not pages. Distinct workflows become pages with URL state.
5. Each page links onward: backend, qubit, alert, timeline, drift. Reuse `lib/investigationLinks.js`.
6. Exit check: `npm run build`, `npx oxlint`, screenshot at 1280 and 390 px, one before/after pair, short sprint report.

## Sprint order

| Sprint | Page | Main change | Status |
|---|---|---|---|
| 6 | Resource health (Health Vector) | Qubit heatmap, per-backend state bars, scatter, qubit drawer with rule evidence and history | Done, see below |
| 7 | Environment | Per-channel time series with thresholds, subsystem status matrix, ingest-path status as a header strip instead of paragraphs, table moved to a collapsible | Done: coverage matrix, derived vs imported labels, room-temp warning, history chart |
| 8 | Platform health | Replace text rows with status tiles (API, DB, collectors, SSE, scheduler), collector table with last-success age, DLQ count, expandable diagnostics | Done: status tiles, live/simulated per provider, stale-telemetry callout |
| 9 | Execution: Jobs and Queues | Split into two routes already in nav; status distribution, duration histogram, queue depth over time, job drawer | Done (verified in browser) |
| 10 | Topology explorer | Full-height canvas, zoom/pan/fit, health-colored nodes, node drawer, list alternative | |
| 11 | Fleet overview + Operator console | Exception-first, remove duplicate KPIs, one fleet trend, qubit health summary linking to Sprint 6 | |
| 12 | Backend workspace + Backends | Registry table with health and freshness; workspace tabs share backend and time range | |
| 13 | Alerts, Timeline, Reports, Admin split | Alert drawer with deep links; timeline overlays; Admin split into Integrations, Collectors, Alert rules | |

## Agent split (parallel where files do not overlap)

- Explorer agent: route inventory and API field matrix for the next two sprints (read only).
- Page builder agent: one page per run, using the prompt below.
- Verifier agent: build, lint, screenshots at two widths, keyboard pass on the new controls.
- Backend agent (only when a sprint needs a missing field): adds the endpoint with a test.

## Prompt for each page sprint (paste into Sonnet)

```
Page: <route>. Read the page source, its CSS, and the API responses it uses.
1. List what is shown, what question each block answers, and what is useless or duplicated.
2. List every field the API returns that the page ignores.
3. Propose the layout: which blocks stay, which merge, which become a drawer or modal, which chart type fits each field and why. Reject chart types the data cannot support.
4. Implement with the existing observability components and chart theme. Label provenance.
5. Add deep links to backend, qubit, alert and timeline views.
6. Handle loading, empty, error, stale and unsupported states honestly.
7. Run build and lint, screenshot desktop and mobile, write a short report.
Do not fake data, add dead controls, or add decoration.
```

## Findings so far (register excerpt)

| ID | Where | Problem | Priority | Status |
|---|---|---|---|---|
| H-01 | Health vector | Qubit health was a collapsed text table | P1 | Fixed in Sprint 6 |
| H-02 | Health scoring, IonQ Forte | `eta_cal` is about 68,000 because T1 is in the millions of µs, so all 36 qubits score YELLOW. The coherence-limit ratio is not meaningful for trapped ions | P0 | UI now explains it; scoring needs a modality-aware rule (backend change, needs your call) |
| H-03 | Health scoring, Rigetti | 85 RED qubits come from real T1 below the 40 µs threshold, but `C_exec` and part of `delta_cal` are missing, so confidence is "none" | P1 | Shown in UI note |
| H-04 | Shell | Breadcrumb repeated the group and page ("Resources > Resources") | P2 | Fixed |
| H-05 | Backend `b1` | Registered with zero qubits, shows UNKNOWN with no data | P2 | Shown as "No qubits reported" |
| H-06 | Environment | `cryo_temp_mK` of 295000 for two backends comes from `calibration_snapshot`, not a sensor; 12.4 vs 15.2 mK for one backend from different sources | P0 | Sprint 7 |
| H-07 | Platform health | Text blocks with no status hierarchy | P1 | Sprint 8 |
| H-08 | Provider capability | API keys give each vendor's own calibration and job data. Adapter, credential, connection and telemetry-flowing states need separate indicators | P1 | Sprint 8 / 13 |
