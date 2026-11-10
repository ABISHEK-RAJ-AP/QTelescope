# UI alignment & density backlog (operator console)

Tracked from operator review · **2026-11-10**. Status: `open` | `partial` | `done`.

| ID | Area | Issue | Status |
| --- | --- | --- | --- |
| UI-01 | Operations Centre | Grid/list alignment, redundant secondary nav buttons | partial |
| UI-02 | Telemetry pages | Duplicate context strip + control card; inline toolbar | partial |
| UI-03 | Backend details | Remove redundant `btn-secondary` link rows (Queues, Drift, …) | partial |
| UI-04 | Qubit drawer | Coupling chips read as `Q20.0001`; metric grid alignment | partial |
| UI-05 | Topology | Empty right column; graph should use full width | partial |
| UI-06 | Calibration timeline | 96+ events without pagination | done |
| UI-07 | Temporal replay | Long frame tables need pagination | done |
| UI-08 | Backend timeline tab | Investigation timeline pagination | done (Ops timeline paginated) |
| UI-09 | Platform health | Pipeline copy noise; dependency hint tone | partial |
| UI-10 | Device capabilities | Export/grid alignment | partial |
| UI-11 | Incidents/alerts grid | Card alignment; edit via modal not row expand | partial |
| UI-12 | Admin | Hide/collapse “Client performance (this browser)” by default | done |
| UI-13 | RBAC matrix | Larger type (cert-studio density); SuperAdmin matrix customize | done (column picker, local) |
| UI-14 | Modals | Health / qubit / advisory — wider `xl` drawer | done (InsightModal xl) |
| UI-15 | Global | Cert-studio-like base font step (~15px app shell) | partial |
| BE-01 | Collectors | SQLite `connectivity_edges` UNIQUE on re-discovery | done |

| UI-16 | Global related nav | `page-related-nav` + CSS; `PageRelatedNav` helper | done |
| UI-17 | Collapsibles default | Ops sections expanded (not over-collapsed) | done |
| UI-18 | Perf first paint | Lazy ECharts in `QtECharts` | done |
| UI-19 | antislop + DESIGN | `docs/product/DESIGN.md`, skills vendored | done |

**Not in scope this pass:** full guided use cases, 3D facility, server-side RBAC matrix editor API, every `btn-secondary` action button (Ack/Resolve stay buttons).
