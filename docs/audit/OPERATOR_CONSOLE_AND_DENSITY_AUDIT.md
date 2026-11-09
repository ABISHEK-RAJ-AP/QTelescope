# Operator console & UI density audit

**Status:** Active programme (2026-11-09)  
**Reference:** QRP Govern `Overview.jsx` — KPI strip, one list, one primary CTA per row.

## Cross-cutting rules

| Rule | Rationale |
| --- | --- |
| One primary action per row/card | Stops “bean soup” (Incident / Backend / Timeline × N) |
| Lane tabs or filters, not 4 duplicate panels | Same data, one mental model |
| Lookback must filter **visible** series (client or API) | Users reported “24h” with no chart change |
| `All backends` always in ContextBar | Scope could not be cleared on Timeline |
| Dev schema (`Included` / `Planned`) collapsed | Operators don’t need roadmap in production UI |
| LDAP help hidden when disabled | Integrations page is not env-var documentation |
| Chart `Show data table` optional, closed by default | Reduces visual noise on comparison pages |
| Tables: row click → workspace where obvious | Comparison / fleet tables |

## Page backlog (user-reported)

| Page | Issues | Status |
| --- | --- | --- |
| Operator console | Bento, small type,太多 buttons | **Fixed** — list/grid, one CTA, lane tabs |
| Ops timeline | Backend dropdown, Related links | **Partial** — All backends, single drawer CTA |
| Calibration timeline | Lookback, stray Drift/Cal buttons | **Partial** — window filter on chart |
| Topology | Qubit panel gaps, random Health/Drift | **Partial** — panel layout, one workspace CTA |
| Backend comparison | Checkbox chips, overlap, dead table | **Partial** — card select, row click |
| Device capabilities | Schema footer, export placement | **Partial** — collapsed schema |
| Incidents | Grid overflow | **Partial** — grid min-width |
| Configure / LDAP | Wall of env text | **Fixed** — hidden when LDAP off |
| Platform health | Text wall, role clarity | **Fixed** — exec bullet list + RBAC note; SLI/synth collapsed |
| Metrics coverage drawer | Thin “Related” | **Fixed** — workspace + explorer + timeline + drift |
| Temporal replay / Backend details | Extra buttons on charts | **Partial** — replay + workspace header trimmed |
| Qubit health / Anomalies nav | Duplicate quick links | **Partial** — sidebar help text; anomaly row CTAs reduced |
| Pagination | Long tables | **Fixed (slice)** — Ops timeline `ListPager`; alerts load-more; EDT paginates |

## Operator console — shipped behaviour

- **KPI strip** → lane filter (not scroll to 4 cards).
- **Next up** — one card, 3 shortcuts max.
- **Action queue** — **List | Grid**, **All** sorts critical-first globally.
- **One** `btn-primary` per queue item (Incident / Alerts / Backend by priority).

## Verification checklist

1. `/app/operate` — Grid layout, All filter, light/dark.
2. `/app/investigate/timeline` — clear backend to “All backends”.
3. `/app/telemetry/calibration-timeline` — change 24h → 6h, chart points drop.
4. `/app/analyze/topology` — select qubit, single “Open qubit in workspace”.
5. `/app/analyze/compare` — click table row → backend details.
6. Configure → no LDAP essay when off.

## Related

- [UX_AND_VISUAL_DESIGN_AUDIT.md](UX_AND_VISUAL_DESIGN_AUDIT.md)
- [WORKFLOW_AND_ACTION_AUDIT.md](WORKFLOW_AND_ACTION_AUDIT.md)
