# Cert Studio vs Q-TeleScope visual comparison

## Reference location

`apps/shared/qre-theme/cert-studio/` — **public/marketing** styles (landing chrome, bento, glow showcase).  
**Not** a full authenticated app shell in this repo.

## Static comparison

| Category | Cert Studio | Q-TeleScope `/app` | Gap |
| --- | --- | --- | --- |
| Typography scale | `--text-3xl` titles, 1.6 LH leads | 16px titles, 12–13px tables | App denser; table copy below Cert comfort |
| Layout width | Centred marketing max-width | `.page-container` fluid with caps | Ops UI correctly wider — compare **density** not marketing width |
| Cards | `landing-bento__card` padding clamp | `page-panel` 16×18px | Comparable |
| Buttons | Public chrome | `btn`, `btn-secondary`, `btn--xs` proliferation | Q-TeleScope smaller variants |
| Tables | N/A in cert CSS | `custom-table` 12/13px | No Cert table reference — use 15px body rule |
| Motion | Hover lift on cards | Subtle | OK for ops (less marketing motion) |
| Theme | CSS variables shared theme | Light/dark in app | Dark table headers still light-grey hex in places |

## Screenshots

**None captured** — Cert Studio pages in this repo are CSS bundles; live Cert app not run here.  
Q-TeleScope screenshots: see [ui-audit/README.md](./ui-audit/README.md).

## How to use Cert as benchmark (Phase 2)

1. Import **minimum body 15px** and **line-height 1.5** (already partially in `app-shell-density.css`).
2. Do **not** import marketing title sizes into ops page titles.
3. Align **button heights** with `page-toolbar-unified` input `min-height: 2.35rem`.
4. Use Cert **spacing variables** (`--space-*`) where Q-TeleScope still uses magic numbers in page CSS.
