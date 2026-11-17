# shadcn, Tailwind, and Govern UI components

## Current repo (QRP Govern)

| Expectation | Actual |
| --- | --- |
| shadcn + TypeScript | **No** — `apps/govern` is **React 19 + JavaScript + Vite 8 + Tailwind 4** |
| Default component path | **`apps/govern/src/components/ui/`** (created for shared primitives) |
| Styles | `index.css` (`@import 'tailwindcss'` + `@theme` aliases), `qre-theme/tokens.css`, `govern.css` |

### Why `components/ui` matters

shadcn and most dashboard recipes assume **`src/components/ui`** for copy-paste primitives (`button`, `card`, grids). A dedicated folder:

- Keeps **ops primitives** separate from feature pages (`pages/`, `components/OverviewDashboardGrid.jsx`).
- Lets you port TS widgets to JSX without scattering files.
- Matches future monorepo extraction (shared UI package).

## `@theme` bridge (shadcn class names on QRE tokens)

In `apps/govern/src/index.css`:

- `bg-card` → `--surface`
- `text-foreground` → `--text-primary`
- `ring-border` / `border-border` → `--border`
- `ring-ring` → `--primary`

Widgets use these classes; they follow light/dark via `data-theme` on `qre-theme`.

## Installed dependency

```bash
cd apps/govern && npm install motion
```

Used by `draggable-widget-grid.jsx` (drag reorder).

## Greenfield shadcn setup (if you add a TS app later)

From a new app directory with `package.json`:

```bash
npx shadcn@latest init
# When prompted: style Default, base color Slate or Zinc, CSS variables yes
# components: @/components/ui
npm install tailwindcss @tailwindcss/vite typescript -D
npm install motion
```

Then copy `draggable-widget-grid.tsx` into `components/ui/` and add the demo only as a **story** — not in production Govern.

## QRP integration

- **Overview** uses `OverviewDashboardGrid` + real governance APIs (queue, quota, activity).
- Layout order persisted per lens: `localStorage` key `govern-overview-widgets-v1:{lens}`.
- Skill: `.cursor/skills/draggable-widget-dashboard/SKILL.md`

## Do not ship in Govern

- The bundled **AI agent observability demo** (fake runs, Claude models, heatmaps) — reference only for grid behaviour, not product UI.
- **`shatterable-glass-card`** (framer-motion + Tone + d3-delaunay) — demo-only; use Cert Studio tiles + `qre-toast` patterns instead.

## Notifications (toasts)

Govern does **not** ship the 21st / shadcn **`live-notification-feed`** demo (autoplay, payment/ride stories, Radix stack). Pattern is ported in **JS + QRE tokens**:

| Piece | Path |
| --- | --- |
| `toast()` + **localStorage** notices (QTS pattern) | `apps/govern/src/lib/toast.js`, `governNotices.js` |
| Server queue / pending approvals sync | `governServerFeed.js`, `GovernNotificationSync.jsx` |
| Live cards + modal panel | `apps/govern/src/components/NotificationHost.jsx` |
| Item-style list rows | `apps/govern/src/components/ui/notify-item.jsx` |
| Topbar bell | `apps/govern/src/components/NotificationBell.jsx` |
| Styles | `.qre-notify-*` in `apps/shared/qre-theme/shell.css` |

Legacy `.qre-toast-*` classes remain for other apps; Govern uses `.qre-notify-card` / `.qre-notify-item`.