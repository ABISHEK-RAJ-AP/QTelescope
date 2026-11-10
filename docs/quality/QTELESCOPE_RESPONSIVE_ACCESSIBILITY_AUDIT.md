# Q-TeleScope responsive and accessibility audit

**Rendered testing:** NOT COMPLETED (no viewport screenshot matrix in this run).

## Responsive breakpoints (CSS evidence)

| Breakpoint | Effect |
| --- | --- |
| 1920px+ | Wider `page-container` max-width |
| 1366px | Smaller `.page-title` (15px) |
| 1100px | Single-column `fo-grid2`, tighter padding |
| 768px | Compact page title variant, mobile shell |

## Expected risk areas (code-based)

| Area | Risk | Severity |
| --- | --- | --- |
| Wide RBAC matrix | Horizontal scroll | P2 |
| ECharts rotate 30° labels | Crowding on 1280px | P1 |
| Alert grouped tables | Many columns + action buttons | P1 @1024 |
| Sidebar | Collapse behaviour — verify touch targets | P2 |
| `btn--xs` in tables | Hit target &lt; 44px | P2 a11y |
| Dark theme tables | Light-theme hardcoded `#f8fafc` th background in `index.css` | P1 contrast in dark |

## Accessibility (partial code review)

| Check | Status |
| --- | --- |
| `aria-label` on EDT search/pagination | Present |
| Table `scope="col"` | Present in EDT |
| `sr-only` on telemetry custom hours | Present |
| Focus rings | Theme/a11y-shell.css — **verify** visibility |
| Chart accessibility | ECharts canvas — limited SR support; panels need text summaries |
| `prefers-reduced-motion` | Mentioned in DESIGN.md; replay — **verify** |
| Keyboard drawer close | Button only — **NEEDS_VERIFICATION** for Escape |

## Viewport checklist (for Phase 1 completion)

Test at: 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1024×768, 768×1024, 390×844 — light and dark.

Store screenshots under `docs/quality/ui-audit/`.
