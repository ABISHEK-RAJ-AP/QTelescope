# Q-TeleScope UI repair checklist

Master tracker for the application-wide UI repair programme. **Cert Studio** (`apps/shared/qre-theme/cert-studio/`) + `docs/product/DESIGN.md` are the visual reference.

| Status | Meaning |
| --- | --- |
| OPEN | Not started |
| PARTIAL | Some fixes landed; verification pending |
| FIXED | Implemented + build/tests |
| BLOCKED | Needs product/API decision |

## P0 — Performance & shell

| ID | Page / area | Defect | Expected | Status |
| --- | --- | --- | --- | --- |
| PERF-01 | Initial load | ECharts in critical path | Async chart chunk only | FIXED |
| PERF-02 | All routes | Measure LCP/INP/CLS | `docs/performance/QTELESCOPE_PERFORMANCE_AUDIT.md` | OPEN |
| GLOBAL-01 | App shell | Body too small | 16px base, Cert-scale hierarchy | PARTIAL |
| GLOBAL-02 | All pages | Redundant `btn-secondary` nav rows | `page-related-nav` / sidebar only | PARTIAL |
| GLOBAL-03 | Modals | Too narrow | `InsightModal` xl + Cert widths | PARTIAL |

## P0 — Platform health

| ID | Defect | Fix | Status |
| --- | --- | --- | --- |
| PH-01 | Synthetic probes on ops page | Removed from operator view | FIXED |
| PH-02 | SLI block with jsonl path | Removed from operator view | FIXED |
| PH-03 | Illustrative monitoring pipeline | Removed from operator view | FIXED |
| PH-04 | `file_sqlite`, RBAC essay in summary | Operator copy only | FIXED |
| PH-05 | Dependency graph clipped | ResizeObserver + full width + toolbar | FIXED |
| PH-06 | Dev API hint under graph | Removed | FIXED |

## P0 — Tables & pagination (representative)

| ID | Page | Defect | Status |
| --- | --- | --- | --- |
| TBL-01 | Calibration events | 96 rows no pager | PARTIAL |
| TBL-02 | Temporal replay tables | 200 frames | FIXED |
| TBL-03 | Incidents grid | Pagination | PARTIAL |
| TBL-04 | Shared `ListPager` | No page-size selector | OPEN |
| TBL-05 | Custom date range | End-to-end API | OPEN |

## P1 — Page queue (remaining)

Operator console, Backend/metrics toolbar, Qubit modal, Topology, Queues, Incidents edit-modal, Device capabilities, Admin RBAC editor — see pasted operator report. Track per route in `UI_VISUAL_REGRESSION_MATRIX.md` (create in Stage 7).

## Skills (verified in repo)

| Skill | Path | Status |
| --- | --- | --- |
| antislop + ui/copy/human/layout/code | `.cursor/skills/antislop*/SKILL.md` | Installed |
| code-humanizer | `.cursor/skills/code-humanizer/` | Installed |
| code-slop | `.cursor/skills/code-slop/` | Installed |

Interactive `npx antislop-ai` marketplace install: run locally (non-TTY env blocked).
