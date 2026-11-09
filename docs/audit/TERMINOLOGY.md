# Q-TeleScope product terminology

**Authority:** Operator-facing UI, exports, and audits. Code mirror: `frontend/src/constants/terminology.js`.

Do **not** mix these concepts into one green badge.

| Term | Meaning | UI examples |
| --- | --- | --- |
| **Reachability** | Provider/registry reports backend contactable | Platform health database tile, collector last run |
| **Operational status** | Advisory QPU state from registry + health vector | Backend workspace badge, inventory |
| **Telemetry age** | Time since last stored telemetry sample | Context bar, platform health telemetry tile |
| **Calibration freshness** | Age vs Fresh / Recent / Aging / Stale windows | Calibration status, backend KPIs |
| **Ingestion quality** | Last collector cycle completeness (JSONL) | Platform health table, backend chip |
| **Data mode** | Live vs simulated lineage per provider | Provenance chips, inventory source column |
| **Availability** (jobs) | Job terminal state counts | Job monitoring — not the same as QPU reachability |

## Display labels (preferred)

| Avoid | Use instead |
| --- | --- |
| Healthy / System healthy | Name the check: "Database reachable", "Collector OK" |
| Online / Connected (interchangeably) | **Reachable** or **Operational status** per context |
| No data | **No records**, **Not available**, or state-specific empty copy |
| Could not load data | **Unable to load** + resource name |
| Nothing to show yet | **Nothing matches the current selection** (or filter-specific) |

## Severity and alert lifecycle

Use existing enums in UI: `CRITICAL`, `WARNING`, `INFO`; alert `ACTIVE` / `ACKNOWLEDGED` / `RESOLVED`; incident `OPEN` / `ACKNOWLEDGED` / `INVESTIGATING` / `RESOLVED`.
