# Govern `components/ui`

Project is **Vite + React (JS) + Tailwind 4**, not a full shadcn TypeScript app.

| Topic | Path |
| --- | --- |
| Primitives | `apps/govern/src/components/ui/` |
| App chrome | `apps/govern/src/components/` + `govern.css` |
| Tokens | `apps/shared/qre-theme/tokens.css` + `index.css` `@theme` |

To adopt **shadcn CLI** on a greenfield TS app: init in a new package with `components.json` → `components/ui`. Then port primitives here or share via a workspace package.

Use **`draggable-widget-grid.jsx`** for layout-customizable dashboards (Overview). See `.cursor/skills/draggable-widget-dashboard/SKILL.md`.

**Not integrated:** `shatterable-glass-card` (Tone.js, d3-delaunay, violet gradient easter egg) — inappropriate for Govern ops/marketing restraint. Landing tiles use **Cert Studio** `studio-feature-grid` + theme-aware primary tint instead.