# Agent skill catalog (external repos → Q-TeleScope)

Verdict per upstream repo the team considered. **Install** = copied/symlinked under `.cursor/skills/`. **Vendor** = shallow clone in `.vendor/skills-upstream/` (gitignored). **Defer** = document only.

## Installed (agent skills)

| Repo | Verdict | In-repo path | When to use |
| --- | --- | --- | --- |
| [abdiraimov-otabek/dashboard-design-skill](https://github.com/abdiraimov-otabek/dashboard-design-skill) | **Install** | `.cursor/skills/dashboard-design/` | KPI tiles, charts, date pickers, wordless monitoring UI, screenshot QA |
| [shinwood/awesome-dashboard-skill](https://github.com/shinwood/awesome-dashboard-skill) | **Install** | `.cursor/skills/awesome-dashboard-skill/` | Dense single-file HTML dashboards, ECharts bento, export/report prototypes |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | **Install** | `.cursor/skills/ui-ux-pro-max/` + `.agents/skills/ui-ux-pro-max/` | Design system search, React ops UI polish |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | **Install** | `.agents/skills/impeccable` (symlink in `.cursor/skills/`) | Operate craft floor; polish/audit/adapt |
| [anthropics/skills](https://github.com/anthropics/skills) `frontend-design` | **Install** | `.agents/skills/frontend-design` | Distinctive UI direction |
| [Dammyjay93/interface-design](https://github.com/Dammyjay93/interface-design) | **Install** | `.agents/skills/interface-design` | Product UI craft |
| [kylezantos/responsive-craft](https://github.com/kylezantos/responsive-craft) | **Install** | `.agents/skills/responsive-craft` | Responsive audit/build |
| [educlopez/ui-craft](https://github.com/educlopez/ui-craft) | **Install** | `.agents/skills/ui-craft` | Product craft restraint |
| [dominikmartn/hue](https://github.com/dominikmartn/hue) | **Install** | `.agents/skills/hue` | Brand → design-skill generator |
| [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) | **Install (marketing only)** | `.agents/skills/scroll-craft` | Scroll landings — never `/app/*` |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) `epic-design` | **Install (marketing only)** | `.agents/skills/epic-design` | Cinematic landings — never `/app/*` |
| [jiji262/claude-design-skill](https://github.com/jiji262/claude-design-skill) | **Install (marketing only)** | `.agents/skills/claude-design` | Design prototypes — never ops console motion |
| [obra/superpowers](https://github.com/obra/superpowers) | **Install** (subset) | `using-superpowers`, `test-driven-development`, `systematic-debugging`, `writing-plans`, `verification-before-completion` | Non-trivial features, debug, plans |
| [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | **Install** (prior) | `.cursor/skills/security-audit/` | Security passes |
| [latent-spaces/brag](https://github.com/latent-spaces/brag) | **Install** (prior) | `.cursor/skills/brag/` | Optional promo video |
| [caldoai/skills](https://github.com/caldoai/skills) `untangle-codebase` | **Install** | `.cursor/skills/untangle-codebase/` | User-invoked structural refactor; ask Comments/Tests first |
| Karpathy guidelines | **Rule** | `.cursor/rules/karpathy-guidelines.mdc` | Always |
| Skill router | **Rule** | `.cursor/rules/skill-router.mdc` | Pick skills before coding |
| [jakubkrehel/skills](https://github.com/jakubkrehel/skills) (interfaces.dev) | **Install** | `.cursor/skills/better-*`, `interface-review`, `explain-interface`, `build-design`, `break`, `state-machine`, `variant`, `teardown`, `afk` | Cross-discipline UI review; refresh `./scripts/install-interfaces-skills.sh` |
| UX interaction laws (project) | **Install** | `.cursor/skills/ux-interaction-laws/` | HCI baseline on top of interfaces.dev — see table in SKILL.md |

Details: [`INTERFACES_DEV.md`](./INTERFACES_DEV.md).

| [Mounir-Ghafir/design](https://github.com/Mounir-Ghafir/design) | **Install (website)** | `.cursor/skills/mounir-ux-website/` | 685-rule evidence files; TeleScope uses `website/` only — [`MOUNIR_DESIGN.md`](./MOUNIR_DESIGN.md) |

## Cursor-only future reference (in repo stubs — not npm)

| Topic | Stub | Clone script |
| --- | --- | --- |
| Lenis | `.cursor/skills/future-reference/lenis.md` | `./scripts/clone-future-skill-repos.sh` |
| Taste Skill | `.cursor/skills/future-reference/taste-skill.md` | `npx skills add` (large; not vendored) |
| Moveable | `.cursor/skills/future-reference/moveable.md` | clone script |
| Whiteboard | `.cursor/skills/future-reference/collaboration-whiteboard.md` | + `docs/product/COLLABORATION_WHITEBOARD.md` |

## Vendor reference only (no agent skill copy)

| Repo | Verdict | Location | Notes |
| --- | --- | --- | --- |
| [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) | **Defer (app)** | `.vendor/skills-upstream/lenis/` | Cursor: `future-reference/lenis.md` |
| [michalsnik/aos](https://github.com/michalsnik/aos) | **Defer** | — | Scroll animations; prefer CSS + `prefers-reduced-motion` in app shell |
| [steveruizok/perfect-freehand](https://github.com/steveruizok/perfect-freehand) | **Defer** | — | Stroke math for whiteboard; not in product roadmap |
| [daybrush/moveable](https://github.com/daybrush/moveable) | **Defer** | — | App uses **@dnd-kit** on dashboard bento; moveable is Figma-like editing |
| [elastic/eui](https://github.com/elastic/eui) | **Defer** | — | Large Elastic DS; conflicts with existing observability UI |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | **Defer** | — | Company marketing sites, browser checker for greenfield HTML |
| [Nainish-Rai/improve-dashboard-ui](https://github.com/Nainish-Rai/improve-dashboard-ui) | **Defer** | — | Redundant with dashboard-design + ui-ux-pro-max; clone if you want extra prompts |

## “Analyst’s mirror” / adaptive BI

Reflective dashboards (behavior logging, personalization) are **out of scope** for current TeleScope unless product adds cross-session analytics UX. Keep monitoring **wordless, honest, session-based** per dashboard-design skill.

## Collaborative whiteboard

Full canvas = **too much for v1**. Phased plan: [`docs/product/COLLABORATION_WHITEBOARD.md`](../product/COLLABORATION_WHITEBOARD.md) — start with incident + chart deep link; live ink only if labs ask after Phase 2.

## npm dependencies (not agent skills)

| Package | Verdict | Notes |
| --- | --- | --- |
| `lenis` | **No** (main app) | Optional future: public marketing page only |
| `perfect-freehand` | **No** | — |
| `moveable` | **No** | — |
| `@dnd-kit/*` | **Yes** (existing) | Dashboard layout drag |

## Refresh installed upstream

```bash
./scripts/refresh-agent-skills.sh   # if present
# or manually:
cd .vendor/skills-upstream/dashboard-design-skill && git pull
cd ../awesome-dashboard-skill && git pull
# re-run copy steps in docs/agent-skills/README.md
```

## Cursor behavior

`.cursor/rules/skill-router.mdc` (`alwaysApply: true`) tells the agent to load the right skill before dashboard, frontend, security, or audit work.
