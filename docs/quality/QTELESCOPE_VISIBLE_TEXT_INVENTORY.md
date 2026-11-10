# Q-TeleScope visible text inventory

**Scope:** High-signal strings and categories. Full exhaustive JSX extraction (~thousands of literals) deferred to scripted pass (`rg` / AST). All entries preserve **exact** current wording.

## Methodology

```bash
rg -n ">[A-Za-z]" frontend/src/pages frontend/src/components --glob '*.jsx'
rg -n "title=|label=|placeholder=|emptyMessage=|emptyTitle=" frontend/src
```

Phase 2 should append rows with stable IDs `TXT-####`.

## P0 — operator safety / developer leakage

| ID | Route / component | Exact text (pattern) | Category | Issue | Direction |
| --- | --- | --- | --- | --- | --- |
| TXT-0001 | `OperationsCentre.jsx` queue title | `Collector ${p.provider_id}: ${bad ? p.status : 'stale'}${p.error ? ` — ${p.error}` : ''}` | Dynamic title | Raw `p.error` (SQL/stack) | Map errors to short operator code; log full server-side |
| TXT-0002 | Many pages | `.catch(() => setPayload(null))` | Error UX | Silent failure | User-safe error component |
| TXT-0003 | API error surfaces | Unfiltered `message={error}` on `ErrorState` | Error | May echo HTTP body | Sanitise display layer |

## P1 — AI-ish / verbose / blog tone

| ID | Route / component | Exact text | Issue | Direction |
| --- | --- | --- | --- | --- |
| TXT-0101 | `ChartPanel` / pages | `chart-panel__question` strings (per-panel “what this shows” paragraphs) | Repetitive didactic tone | Short provenance line or remove |
| TXT-0102 | `appSidebarNav.js` `NAV_HELP` | Long help descriptions per nav item | Sidebar noise if surfaced | Tooltip one-liners |
| TXT-0103 | `PlatformHealth` (post-edit) | Operator summary copy | Verify no “SLI/synthetic” jargon left on operator view | Keep concise status |
| TXT-0104 | Onboarding / marketing cross-links | Product pitch strings | Risk generic SaaS tone | Ops-first wording |

## P1 — redundant navigation labels (as visible text)

| ID | Component | Example labels | Issue |
| --- | --- | --- | --- |
| TXT-0201 | Alerts drawer buttons | `Timeline`, `Resource health`, `Backend qubits`, `Drift` | Duplicate sidebar IA |
| TXT-0202 | Queue drawer | `Backend execution`, `Timeline` | Same |
| TXT-0203 | Repeated | `Open workspace` | OK contextually — keep |

## P2 — inconsistent terminology

| Term variants | Where | Direction |
| --- | --- | --- |
| Backend / provider / collector | Operations, platform | Glossary in DESIGN.md |
| Ack / Acknowledge | Alerts | Single verb |
| Lookback / window / hours | Telemetry | Single control label |
| Incident vs alert | Alerts module | Keep precise RBAC labels |

## P2 — placeholder / empty states (representative)

| ID | Exact text | Location |
| --- | --- | --- |
| TXT-0301 | `No rows` / `Nothing matched the current filters.` | `EnterpriseDataTable` defaults |
| TXT-0302 | `Insufficient history` / `Expand lookback or wait for more qubit telemetry samples.` | `CalibrationTimeline` ChartPanel |
| TXT-0303 | `No history` / `No stored queue samples yet.` | `QueueMonitoring` |
| TXT-0304 | `Not enough stored samples to draw a trend.` | `QueueMonitoring` |

## P3 — uppercase / metadata

| Pattern | Example | Issue |
| --- | --- | --- |
| Table headers | ALL CAPS in `.custom-table th` | Harder to read; not content but visual |
| Status badges | Mixed case in components | Standardise in badge component |

## Strings that must remain

- Provenance: `sourceKind` on charts (`cached`, live, etc.)
- Modality warnings (e.g. trapped-ion T1 scale callout in `CalibrationTimeline`)
- Permission-denied and destructive confirm copy on Admin
- IST timestamps and “stale” semantics

## Completion status

| Bucket | Status |
| --- | --- |
| Safety / errors | Sampled — **TXT-0001 confirmed in source** |
| All JSX literals | **PARTIAL** — run extraction script before launch sign-off |
| Dynamic API strings | **NOT INVENTORIED** — requires runtime capture |

## Appendix A — `ChartPanel` `question` strings (verbatim)

| ID | Source file | Exact text | Issue |
| --- | --- | --- | --- |
| TXT-CH01 | `DashboardHome.jsx` | Pending jobs per backend — click a bar to open that machine. | OK ops tone |
| TXT-CH02 | `DashboardHome.jsx` | Pending jobs from the latest queue snapshot. | Repetitive with CH01 |
| TXT-CH03 | `DashboardHome.jsx` | Hours since last calibration snapshot (oldest first). | OK |
| TXT-CH04 | `DashboardHome.jsx` | Where active critical/warning load concentrates — click a bar to open that backend. | Long |
| TXT-CH05 | `DashboardHome.jsx` | Pending jobs vs mean T1 per backend (same modality only). | OK |
| TXT-CH06 | `DashboardHome.jsx` | Advisory router state counts on lowest-ranked backends. | Jargon “router” |
| TXT-CH07 | `DashboardHome.jsx` | Mean and minimum T1 per backend (log scale). Compare within the same modality. | OK |
| TXT-CH08 | `PlatformHealth.jsx` | Slowest adapter on the most recent run. | OK |
| TXT-CH09 | `PlatformHealth.jsx` | OK versus attention required. | Vague |
| TXT-CH10 | `OpsTimeline.jsx` | Chronological view by backend and event type. | Didactic |
| TXT-CH11 | `TemporalReplay.jsx` | Playhead marks the selected frame. Click to jump. | OK |
| TXT-CH12 | `TemporalReplay.jsx` | Panels with data at each frame (missing counts are explicit). | Developer-ish |
| TXT-CH13 | `TopologyExplorer.jsx` | Qubit nodes coloured by selected metric. Shapes indicate health state. Edge width proportional to gate error. | Long tutorial |
| TXT-CH14 | `AnomalyMonitor.jsx` | Flagged qubits from the latest scan — select a cell for the series. | OK |
| TXT-CH15 | `EnvironmentPage.jsx` | Imported vs derived samples by backend and channel. | OK provenance |

*Additional `question=` lines exist on Drift, Historical trends, Backend comparison, Backend details, Metrics explorer, Resource health — grep `question=` under `frontend/src/pages` for full list.*
