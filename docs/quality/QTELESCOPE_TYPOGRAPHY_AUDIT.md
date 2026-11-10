# Q-TeleScope typography audit

**Method:** CSS source + token trace + **Chromium computed styles** (2026-11-10 authenticated pass).  
**Benchmark:** Cert Studio public chrome (`apps/shared/qre-theme/cert-studio/`) vs `/app/*` (`index.css`, `app-shell-density.css`, page CSS).

## Measured computed ( `/app/alerts`, 2026-11-10 )

| Selector | font-size | weight | line-height |
| --- | --- | --- | --- |
| `h1` | 23.76px | 800 | 35.64px |
| `.page-stack` | 17.6px | 400 | 26.4px |
| `.custom-table th` | **12px** | 700 | 18px |
| `.custom-table td` | **13px** | 400 | 19.5px |

Shell body ~17.6px vs table cells 13px (**4.6px gap**). See [ui-audit/EVIDENCE_INDEX.md](./ui-audit/EVIDENCE_INDEX.md).

**2026-11-10 repair:** `design-tokens.css` table **1rem**; `typography-ops-floor.css` on `.main-content`; Fleet overview `fo-*` (alerts-by-severity panel) bumped. Re-capture recommended after deploy.

## Global system

| Layer | Family / size | Weight | Issue | Direction |
| --- | --- | --- | --- | --- |
| `.page-stack` (density) | 16px × `--ui-density` | inherit | Conflicts with `DESIGN.md` “15px base” | Pick one canonical base (16px aligned to Cert comfortable body) |
| `.page-title` | 16px → **15px** @≤1366px | 700 | Reads as section label, not page title | Bump to 1.125–1.25rem; decouple from breakpoint shrink |
| `.custom-table th` | **12px** uppercase | 700 | Dense ops tables hard to scan | 0.75rem min with 0.05em tracking, or 13px non-uppercase |
| `.custom-table td` | **13px** | 400 | Below shell 16px body rhythm | 0.9375rem (15px) per DESIGN.md |
| `.chart-panel__question` | ~11.5px (observability.css) | 500 | Explainer copy too small vs Cert lead (1.6 LH) | 13–14px secondary |
| Sidebar nav items | ~13px (index/shell) | 500–600 | OK density; group labels **10px** | Raise group labels to 11–12px |
| `TelemetryWindowControl` label | **12px** inline style | 600 | One-off vs toolbar tokens | Use `.context-bar__label` token |
| ECharts axis (e.g. cal timeline) | **9–10px** in options | — | Illegible on 1366×768 | Centralise chart text size in `chartTheme.js` ≥11px |
| BackendDetails panels | 10–13px mix | varies | Page-local scale drift | Consolidate to shell tokens |

## Root causes (code)

1. **Dual authority:** `app-shell-density.css` sets 16px on `.page-stack`; `index.css` keeps table/header at 12–13px; page CSS (`TelemetryPages.css`, `BackendDetails.css`) adds third scale.
2. **Breakpoint regression:** `@media (max-width: 1366px)` reduces `.page-title` — makes “too small” worse on common laptops.
3. **Inline styles:** `TelemetryWindowControl.jsx`, many page toolbars bypass design tokens.
4. **Chart options:** Per-page `fontSize` in ECharts option objects (not theme defaults).

## Cert Studio comparison (static)

| Element | Cert Studio (landing) | Q-TeleScope `/app` |
| --- | --- | --- |
| Section titles | `var(--text-3xl)` display | 16px page title |
| Lead copy | centred, LH 1.6, secondary colour | `chart-panel__question` ~11.5px |
| Card padding | clamp 1.25–1.5rem | 16px 18px (reasonable) |

Cert Studio in repo is **marketing/landing** CSS, not a full app shell — use it for **minimum readable sizes and rhythm**, not literal title scale in dense ops UI.

## Computed styles (live — light theme)

| Component | Route | Computed | Problem |
| --- | --- | --- | --- |
| Page `h1` (shell head) | `/app/overview`, `/app/operate` | **23.76px / 800** Inter | **Differs from** `.page-title` {16px} in `index.css` — two title systems |
| Sidebar active nav | `/app/overview` | **13px / 700** | Acceptable; group labels still smaller in CSS |
| `.custom-table` | `/app/admin/users` | (screenshot shows dense directory; re-run CDP on `th`/`td` on next pass) | Visually smaller than 23px page title — hierarchy inverted |

Evidence: [ui-audit/EVIDENCE_INDEX.md](./ui-audit/EVIDENCE_INDEX.md).

## Verification still needed

- [ ] `.custom-table th/td` computed on data-heavy route (Alerts)
- [ ] Dark theme same sample
- [ ] Screenshot diff vs Cert landing at 1440×900

See [QTELESCOPE_CERT_STUDIO_COMPARISON.md](./QTELESCOPE_CERT_STUDIO_COMPARISON.md).
