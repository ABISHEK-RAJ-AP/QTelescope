# Q-TeleScope tables, pagination, sorting, filters

## EnterpriseDataTable behaviour

- **Sort:** Client-side on filtered rows; `SortableTh` toggles asc/desc.
- **Search:** Client substring on `searchKeys`.
- **Pagination:** Client slice via `useTableKit`; **fixed `pageSize` prop** per page; **no** page-size UI.
- **Footer:** Total row count + prev/next only when `totalCount > pageSize`.

## Table inventory

| Page / table | Data source | Pagination | Page size | Sort | Filter / search | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Alerts (list mode) | API全量 → client | Yes (EDT) | 15 | Yes | Filters + search | Large fetch risk |
| Incidents | API → client | Yes | 15 | Yes | Yes | Drawer actions heavy |
| Ops timeline | API | Yes | (default 15) | Yes | Time scope | — |
| Admin users | API | Yes | 15 | Yes | Search | — |
| Platform health (collectors) | API | Yes | 12 | Yes | — | — |
| Calibration status events | API | Yes | 15 | Yes | — | — |
| Job monitoring | API | Yes | 15 | Yes | — | — |
| Temporal replay tables | local | Yes | varies | Partial | — | — |
| **Calibration timeline events** | API window | **Yes (custom)** | 25 | No | Lookback hours | Fetches all events in window then slices |
| **Queue monitoring history** | `/history?limit=100` | **No** | all rows in table | No | Backend pick | **P1:** flatMap renders all samples |
| Queue ranked table | API | No | all queues | Client sort | Search | OK if fleet small |
| Backend inventory | varies | Partial / page-owned | — | — | — | Verify in page |
| Metrics explorer | API samples | Often none | — | — | Metric/backend | Long lists |
| Device capabilities | grid | N/A | — | — | — | Not classic table |
| RBAC matrix | static config | Scroll | — | No | — | Readability issue |

## Custom date / time range

| Control | Behaviour | Gap |
| --- | --- | --- |
| `ContextBar` + `TimeRangeSelector` | Preset hours | No calendar start/end |
| `TelemetryWindowControl` | Presets + **custom hours** 1–720 | Not a “custom date range” in audit sense |
| Ops timeline / investigations | Deep links with `at` query | Not unified date picker |

**Verdict on known issue #5:** “Custom date range” for telemetry = **hours lookback only**; datetime range **not implemented** in UI. Mark **OPEN** (product gap) unless backend supports ISO range elsewhere.

## Sorting verification

- EDT sort: **functional** (unit-tested patterns in `EnterpriseDataTable.test.jsx`).
- Decorative sort icons on non-EDT tables: **spot-check required** per page.

## Server-side pagination

**Not used** in shared table component. Any table loading full API lists is a **scale risk** (alerts, calibration events in wide lookback, queue history).
