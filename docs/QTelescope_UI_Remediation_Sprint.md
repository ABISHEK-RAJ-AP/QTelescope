# Q-TeleScope UI remediation sprint (baseline)

## P0 — done this pass

| ID | Fix |
|----|-----|
| A11Y-01 | Root typography: `html` rem scale + `body` in rem (was header-only effect). |
| A11Y-02 | Reduce motion toggles `body._access_pause_anim` + `html.a11y-reduce-motion`; WebGL off when motion reduced. |
| A11Y-03 | Focus mode de-emphasizes secondary copy; reading-line (formerly ADHD) labeled clearly. |
| A11Y-04 | On-screen keyboard component (`data-a11y-osk`) types into focused inputs. |
| A11Y-05 | Removed header Compact/Expand; use accessibility text size instead. |
| A11Y-06 | Removed redundant Static 3D control; merged into Reduce motion. |
| CHART-01 | Shared chart expand (presentation modal) on all `ChartPanel` ready states. |
| CHART-02 | Provenance shown as compact dot + tooltip; expand icon in chart header. |
| OPS-01 | Operator console: trimmed meta nag copy, action button groups, meaningful empty lanes. |
| PH-01 | Platform health: summary, SSE tile, duration + pie charts, activity list, real data tables. |
| CHART-03 | `QtECharts` + `polishChartOption`: scroll legends, grid padding, font-scale; a11y change event re-polish. |
| BK-01 | Backend **library** grid (Cert Studio–style cards), table toggle, add-backend wizard; single workspace on card click. |

## P1 — next

- Route-by-route content audit (empty sections, demo consistency).
- Convert remaining fixed `px` typography in page CSS to rem/`--font-scale`.
- Global page action toolbar alignment in `PageHeader`.
- Fleet overview freshness KPI copy (align with calibration status labels).

## Verification

```bash
cd frontend && npm run build
# Manual: accessibility text +/- , reduce motion, OSK on input, chart expand on Platform Health / Calibration.
```
