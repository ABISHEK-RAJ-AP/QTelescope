# UI components (`components/ui`)

This app follows the **shadcn-style layout** (presentational pieces under `components/ui`, `cn()` helper, Tailwind utilities) without requiring the full shadcn CLI.

## Already configured

| Piece | Location |
| --- | --- |
| Tailwind CSS v4 | `vite.config.js` + `@tailwindcss/vite` |
| TypeScript | devDependency; `.tsx` components compile via Vite |
| Path alias `@/` | `vite.config.js` → `src/` |
| `cn()` | `src/lib/utils.ts` (also `utils.js` for legacy JSX) |

## Adding shadcn CLI components (optional)

From `frontend/`:

```bash
npx shadcn@latest init
# Accept src/ as root, components → src/components/ui, utils → src/lib/utils.ts
npx shadcn@latest add button
```

**Why `components/ui`?** shadcn and most React design docs assume this folder so imports stay `@/components/ui/*` and match copy-paste snippets (including community demos).

## Landing integrations

- `kinetic-matrix.tsx` — lattice hero animation (hex node labels on hover)
- `path-drawing-portfolio-hero.tsx` — SVG path-drawn brand title (motion)

Both respect **light/dark** via `document.documentElement.classList` (`ThemeProvider`).
