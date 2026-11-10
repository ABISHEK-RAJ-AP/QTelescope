# Q-TeleScope navigation and actions

## Sidebar

- Source: `appSidebarNav.js` + `appNav.js` modules (Observe, Platform, Telemetry, …).
- Help copy: `NAV_HELP` object — long descriptive strings in sidebar tooltips/help (content audit flagged).

## Breadcrumbs

- Set per route in shell / pages; **verify** active path on nested backend tabs.

## Redundant secondary navigation (known #4)

| Pattern | Examples | Recommendation |
| --- | --- | --- |
| `btn-secondary` cross-links | Alerts drawer → Timeline, Resource health, Backend qubits, Drift | Replace with `page-related-nav` link row |
| Queue drawer | Backend execution, Timeline buttons | Same |
| Device capabilities | Multiple secondary buttons | Consolidate |
| `PageRelatedNav` | Drift, Historical trends | **Keep** — target pattern |

## Page toolbar actions

- `PageActionsContext` — refresh on many telemetry pages (good).
- Duplicate: context bar refresh + page header refresh on some pages — **NEEDS_VERIFICATION**.

## Role-gated actions

- Alerts ack/resolve respect `perms` in `AlertsEvents.jsx`.
- Admin routes behind role checks in router — confirm in `App.jsx`.

## Dead / legacy paths

- `isLegacyAppPath` redirects — document only; no dead sidebar entries found in static review.
