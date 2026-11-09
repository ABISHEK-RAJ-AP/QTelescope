# Accessibility and responsiveness audit

**Status:** Initial pass (2026-11-09)  
**Scope:** Q-TeleScope `frontend/` authenticated shell + ops pages.

## Baseline tooling

| Mechanism | Location | Notes |
| --- | --- | --- |
| Theme contrast | `design-tokens.css` + `.dark` in `index.css` | Status colors via `--ds-status-*` |
| Font scale | `--font-scale`, `chartTheme.scaledFont()` | Charts respect user scale |
| Reduced motion | `TemporalReplay.jsx` `reducedMotion()` | **Spot-check only** |
| A11y panel | `components/shell/A11yPanel.jsx`, `A11yRuntimeEffects.jsx` | Font scale, focus — **NEEDS_VERIFICATION** |
| On-screen keyboard | `OnScreenKeyboard.jsx` | Dense forms |
| Captcha labels | `AuthShell` + E2E fixes | Login journey |

## Keyboard and focus (sampled)

| Surface | Verdict | Gap |
| --- | --- | --- |
| Command palette | PASS pattern | Trap + return focus — verify |
| `EnterpriseDataTable` | Row click + sort headers | Checkbox column E10 — fixed |
| `DetailDrawer` | Opens from tables | Escape + focus wrap **PASS** |
| `ConfirmDialog` | Ack flows | Focus on primary button |
| Chart expand modal | `ChartExpandModal.jsx` | Close on Escape **PASS** |

## Color and non-text cues

| Area | Verdict |
| --- | --- |
| Severity badges | `SevBadge` + TERMINOLOGY — not color-only on anomaly heatmap (letter in cell) |
| Chart series | Tokenized via `getChartSemanticColors()` (2026-11-09 sweep) |
| Router state bars | `StateBar` uses glyph + label |

## Responsive (1024px / mobile)

| Page | Verdict |
| --- | --- |
| Alerts ungrouped EDT | Horizontal scroll; sticky header |
| Backend workspace tabs | Tab strip scroll |
| Dashboard bento | `DashboardBentoGrid` reflow |
| Sidebar | Collapse — **manual pass pending** |

## WCAG 2.2 targets (programme)

| ID | Criterion | Status |
| --- | --- | --- |
| A-01 | 2.4.11 Focus not obscured | **PARTIAL** — `scroll-padding-top` on modals |
| A-02 | 2.5.8 Target size (24px) | **PARTIAL** — EDT `btn--xs` min 24px |
| A-03 | 1.4.3 Contrast (UI) | **PARTIAL** — token pass; badge hex legacy |
| A-04 | 2.3.3 Animation from interactions | `prefers-reduced-motion` partial |

## Recommended tests

1. Playwright: axe-lite on `/app/alerts`, `/app/platform-health` (no new dep — manual checklist OK for now).
2. 1024×768 viewport screenshot pass (Release B B9).
3. Keyboard-only journey: palette → alerts → ack dialog.

## Next

Pair with [FRONTEND_COMPONENT_AUDIT.md](FRONTEND_COMPONENT_AUDIT.md) FC-04; close A-02 after table density review.
