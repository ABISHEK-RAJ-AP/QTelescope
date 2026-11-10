# Q-TeleScope frontend implementation plan

**Started:** 2026-11-10 · Governs Batch 1–5 repair programme.

## Baseline

- Audit package: `docs/quality/QTELESCOPE_*`
- Stack: React 19, Vite 8, lazy `/app/*` routes (~35)
- API: `E2E_CAPTCHA_BYPASS=1` for audit capture only

## Batch status

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Typography tokens, tables, page title breakpoint, chart legend min size, operator error mapping | **In progress** |
| 2 | `EnterpriseDataTable` pager, queue history pager, telemetry “Custom hours” label | **In progress** |
| 3 | Operator console, platform, backends, queues, alerts | **Started** (platform banner removed, ChartPanel titleTo, grid cards) |
| 4 | Telemetry, admin, capabilities | Not started |
| 5 | Screenshot matrix, a11y, perf measurements | Not started |

## Completed this wave

- **UI-001** `operatorFault.js` + OperationsCentre collector titles
- **UI-002/013/015** Table typography tokens; removed 1366px `.page-title` shrink; theme-aware table surfaces
- **UI-006** EDT page size, range, first/last
- **UI-003/008** Queue history client pager (25)
- **UI-004** (partial) Rename misleading “Custom range” → “Custom hours”
- Connectivity edge re-insert: already in `telemetry_collector.py` (delete-before-insert)

## Next (Batch 1 finish + Batch 3 start)

1. `PageRelatedNav` on Alerts drawer (UI-005)
2. `BackendDetails` toolbar unification (UI-008)
3. Admin RBAC matrix type scale (UI-012)
4. Re-capture typography after tokens (`audit-capture` + computed samples)

## Verification per batch

- `cd frontend && npm run test && npm run build`
- Playwright `--project=audit-capture` after visual changes
- Update `QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md` status + evidence path
