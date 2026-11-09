# Collaboration & “whiteboard” for multi-backend researchers

**Status:** Decision guide (2026-11-09) — not a build ticket.

## The idea

Researchers comparing IBM, ionQ, on-prem, etc. may want to **discuss** what they see on dashboards and charts — not only file incidents.

A full Miro-style infinite canvas (pen, touch, live cursors, WebSocket) is **a different product**. It is high cost: CRDT/sync, permissions, export, a11y, and conflict with dense ops tables.

## Recommendation (phased)

| Phase | What | Effort | Fits TeleScope? |
| --- | --- | --- | --- |
| **0 (now)** | Incidents + alerts as the discussion record; workspace deep links in drawer CTAs | Shipped | Yes |
| **1** | **Chart context in incidents** — attach backend id, metric, time range, screenshot PNG from existing chart export | Small API + UI | Yes — ties discussion to data |
| **2** | **Shared saved views** — permalink bento layout + filters (no live ink) | Medium | Yes — researchers align on same lens |
| **3** | **Annotate snapshot** — single PNG, rectangle/text pins, no live multi-user ink | Medium | Maybe — one author, others comment async |
| **4** | **Live whiteboard** — perfect-freehand + moveable + WS | Large | Only if Phase 1–2 fail user tests |

**Default:** Stop at Phase 2 unless lab users explicitly ask for freehand on top of charts.

## Why not jump to Phase 4

- Ops UI is **wordless monitoring** (dashboard-design skill): numbers first, sentences in tooltips.
- Touch targets and EDT density already fight with canvas overlays on 1024px laptops.
- `prefers-reduced-motion` and keyboard-first operators suffer on smooth-scroll + animated canvas combos.
- Security: arbitrary drawing + paste + WS = new abuse surface on admin networks.

## If you still want “discussion on charts” soon

Smallest honest feature:

1. From any `ChartPanel`, **Copy link to this view** (route + query: backend, range, metric).
2. **Add to incident** pre-fills description with that URL + optional PNG from client-side canvas export (ECharts `getDataURL`).
3. Optional thread comments on **incident only** (existing model), not on the chart DOM.

No new npm packages required for Phase 1.

## Cursor / agent skills

- App repo: **no** lenis, moveable, taste-skill, whiteboard deps.
- Cursor only: `.cursor/skills/future-reference/` + optional `scripts/clone-future-skill-repos.sh`.

## Open questions for product

1. Is async incident comment enough for “discussion”?
2. Do labs need **synchronous** review (pair during a run), or next-day review?
3. Export to PDF/slides more valuable than ink?

Answer those before Phase 3+.
