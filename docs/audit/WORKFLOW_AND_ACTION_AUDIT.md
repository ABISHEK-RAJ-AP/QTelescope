# Workflow and action audit

**Status:** In progress (2026-11-09)  
**Method:** Command palette inventory + Playwright journey map + spot checks.

## Global navigation (verified routes)

Source: `frontend/src/components/shell/CommandPalette.jsx` — all entries map to real `buildAppPath` / `href` targets.

| Action | Path | E2E |
| --- | --- | --- |
| Fleet overview | `/app/overview` | E05–E06 ✅ |
| Platform health | `/app/platform/health` | smoke ✅ |
| Job monitoring | `/app/execution/jobs` | E13 ✅ |
| Active alerts | `/app/alerts` | partial (E10 skip) |
| Open incidents | `/app/alerts/incidents` | E11–E12 ✅ |
| Metrics explorer | `/app/telemetry/explorer` | E26 ✅ |
| Audit log | `/app/admin/logs` | E25 ✅ |
| Collectors | `/app/admin/collectors` | E17 ✅ |

Entity search (≥2 chars): backends, alerts, incidents, jobs, collectors — `CommandPalette.jsx`.

## Critical journeys

| Journey | Steps | Evidence | Gap |
| --- | --- | --- | --- |
| Login → dashboard | CAPTCHA → optional MFA → overview | E01–E05 ✅ | — |
| Backend → workspace | Inventory row → details tabs | E07 ✅ | — |
| Alert → logs | Detail → Related logs → admin logs tab | code + manual | no dedicated E2E |
| Alert ack | Ungroup → Ack → confirm dialog | E10 test updated | Re-run Playwright |
| Incident lifecycle | Ack → investigate → resolve | E11–E12 ✅ | — |
| Collector run | Admin → run collection → history JSONL | E17 ✅ | — |
| Report export | Configure → download | E15 ✅ | PDF audit pending |
| Session revoke | Settings → revoke others | E21 ⬜ skip | needs 2-session setup |

## Refresh controls

Pattern: `RefreshButton` in `PageActionsContext` on major pages — calls page `load()` (re-fetch API). **Verified pattern** on PlatformHealth, Jobs, BackendDetails, Alerts (poll).

## Destructive / confirm actions

| Control | Confirm? | API |
| --- | --- | --- |
| Alert bulk resolve | `ConfirmDialog` | `/alerts/bulk` |
| Incident resolve | `ConfirmDialog` | incident API |
| DLQ purge | modal in Admin | admin |
| User role change | varies | admin users |

## P1 open actions

| ID | Issue | Next step |
| --- | --- | --- |
| W-01 | E10 alert acknowledgement | Stabilize test data or document skip reason in spec |
| W-02 | Grouped alerts table vs EDT | Keep expand UX; ungrouped EDT pass later |
| W-03 | Export empty file guard | REPORTS_AND_EXPORTS audit |
