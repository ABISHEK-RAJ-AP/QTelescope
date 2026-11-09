# Testing and defect report

**As of:** 2026-11-09

## Executed suites

| Suite | Command | Result |
| --- | --- | --- |
| Vitest | `cd frontend && npm test` | **12 passed** (+ `csvExport.test.js`) |
| Production build | `cd frontend && npm run build` | **OK** (~1s) |
| Playwright telescope | `scripts/run-e2e-telescope.sh` | **28 passed, 2 skipped, 0 failed** (2026-11-09 full gate) |
| pytest (observability) | `pytest tests/test_collector_executions.py …` | **11+ passed** |

## Playwright skips (tracked)

| Test | Reason | Remediation |
| --- | --- | --- |
| E10 | Grouped Ack label | **Fixed** — ungroup + Ack selector; **passed** 2026-11-09 |
| E21 | Second session API | Env setup |
| E23 | Deep route refresh | Env |

## Defects closed this programme (sample)

| ID | Summary |
| --- | --- |
| D-AUD-01 | Shared empty/error copy centralized |
| D-AUD-02 | Load errors standardized (`unableToLoad`) |
| D-AUD-03 | Incidents + ungrouped alerts → EnterpriseDataTable |
| D-AUD-04 | E10 test aligned with grouped alerts UI |

## Not executed (blocked)

| Item | Block |
| --- | --- |
| Full pytest | Time — run before release gate |
| pip-audit / npm audit | Scheduled security pass |
| Multi-viewport a11y | ACCESSIBILITY doc pending |
| Live provider E2E | No production credentials |

## Re-run commands

```bash
cd frontend && npm test && npm run build
cd .. && PW_WORKERS=1 bash scripts/run-e2e-telescope.sh
python -m pytest tests/ -q --tb=no
```
