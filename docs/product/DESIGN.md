# Q-TeleScope operator UI — design direction

Visual direction for `/app/*` (antislop filter + this file). Not a marketing site.

## Intent

- **Audience:** quantum ops engineers, incident commanders, fleet admins (C-DAC demo + field).
- **Tone:** calm control room — dense but readable, no hype copy, no fake latency badges.
- **Job:** triage → investigate → act, with provenance on every chart and table.

## Layout

- **Shell:** left nav + page header + single primary toolbar card per page (`page-toolbar-unified`).
- **Grids:** `repeat(auto-fill, minmax(...))` — cards stretch equal height; no orphaned empty columns.
- **Related navigation:** text links (`fs-link` / `page-related-nav`), not rows of `btn-secondary`.
- **Modals / insight panels:** wide (`xl` ~920px) for rule evidence and qubit detail; one primary action per footer.

## Typography & density

- Canonical tokens in `frontend/src/styles/design-tokens.css` (`--font-size-body` 1rem, table **1rem**, page title **1.375rem**).
- `frontend/src/styles/typography-ops-floor.css` raises type inside `.main-content` above legacy 10–12px page CSS.
- KPI numbers tabular; labels use `--font-size-micro-label`.
- Cert-studio reference: comfortable line-height 1.5, no sub-12px body copy on ops pages.

## Color & state

- Use existing tokens: `--accent-cyan` links, semantic badges (healthy / warning / critical).
- No purple-on-white SaaS gradients; no decorative sparkles or “AI 2.0” pills.
- Stale data: explicit callout + timestamp (IST), never silent blanks.

## Motion

- Respect `prefers-reduced-motion` (replay autoplay off when set).
- KPI count animation subtle; no gratuitous parallax.

## Content rules

- Headlines state what the panel **shows**, not what the product “empowers”.
- No invented stats; “—” when unknown.
- Admin/debug (client vitals) visible but not shouting — collapsible only when operator asks to hide noise.

## Performance

- Route-level code split (existing).
- Charts load ECharts **lazily** on first chart mount — initial bundle must not block first paint.

## Acceptance (Delivery gate)

Before claiming a UI pass done:

1. No duplicate context bars on same page.
2. Related pages = link row, not secondary button strip.
3. Long tables paginated or virtualized (25–50 rows/page).
4. Collapsible analytics sections **open by default** unless marked optional/debug.
5. `npm run build` succeeds; spot-check Operations, Alerts, Resource health, Platform health.
