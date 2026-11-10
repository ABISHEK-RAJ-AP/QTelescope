# Q-TeleScope modals and drawers

## Sizes (CSS)

| Class | Width | Path |
| --- | --- | --- |
| `detail-drawer--xl` | min(920px, 96vw) | `app-shell-density.css` |
| Default drawer | narrower (observability.css) | `DetailDrawer.jsx` |
| `InsightModal` | uses layout wrapper | `DetailModalLayout.jsx` |

## Instances

| Trigger | Component | Width / scroll | Issues |
| --- | --- | --- | --- |
| Alert row | `DetailDrawer` on `AlertsEvents` | Full height, scroll body | **P1:** 4+ `btn-secondary` full-width nav buttons in footer |
| Incident workspace | `IncidentDetailPage` | Page not modal | Edit flows page-level |
| Queue row Details | `QueueMonitoring` drawer | Custom | History list unbounded |
| Qubit / resource | `InsightModal` xl | Intended wide | **P1:** label/value structure varies; verify topology tab |
| Advisory / rule evidence | Admin + alerts | Often default width | **P1:** reported too narrow — confirm `size="xl"` on all evidence modals |
| Platform pipeline | drawer component | Exists | Removed from operator Platform health main view (verify) |

## Keyboard / focus

- Drawers use close button; **NEEDS_VERIFICATION:** focus trap, Escape, initial focus on open.
- Modals: depends on `InsightModal` implementation — audit in browser.

## Edit workflows

- Many **inline** ack/resolve/comment actions on Alerts.
- Admin user/role forms on `AdministrationPage` — predominantly **page panels**, not dedicated edit modals.
- **Known issue #20:** Partial — some flows modal, many inline.
