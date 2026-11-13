---
description: Route work through project agent skills before coding (dashboard, UI, security, debug, audits). Pair with ponytail — no new deps without need.
alwaysApply: true
---

# Skill router (Q-TeleScope)

Before non-trivial implementation, **read and follow** the matching skill under `.cursor/skills/` (or rule under `.cursor/rules/`). Trivial one-liners: skip skills.

## Route map

| Work type | Paths / triggers | Skill or rule |
| --- | --- | --- |
| Always | Any change | `.cursor/rules/karpathy-guidelines.mdc` — assumptions, smallest diff, verify |
| Efficiency | Any feature | `using-superpowers` — workflow; `writing-plans` if multi-step |
| Frontend UI, density, a11y, ops chrome | `frontend/**`, observability components | **Operate stack:** `impeccable` (Operate mode + craft-floor) · `interface-design` · `ui-ux-pro-max` (search) · `responsive-craft` · `ux-interaction-laws` · `mounir-ux-website` · `better-*` · **antislop** + `antislop-ui` + `docs/product/DESIGN.md` (DESIGN wins over skill palette guesses) |
| New distinctive surface / aesthetic direction | greenfield page, visual world | `frontend-design` then `impeccable`; keep IBM Plex + cyan unless redesigning DESIGN.md |
| Product UI craft (dashboards, settings, tools) | `/app/*` polish / hierarchy | `interface-design` + `ui-craft` (ops restraint — no marketing chrome) |
| Responsive / breakpoints / sticky shell | mobile nav, tables, clamp, container queries | `responsive-craft` (intrinsic → CQ → MQ) |
| Brand / design-language skill generator | user asks new brand skill from URL/screenshot | `hue` → writes a generated skill; do not invent palette over DESIGN.md |
| Marketing / landing cinematic scroll | public landings only, never `/app/*` | `scroll-craft`, `epic-design`, `claude-design` — **HARD_BLOCK on ops console** |
| interfaces.dev layout / type / color / copy | grid, filters, cards, operator strings | `better-layout`, `better-typography`, `better-colors`, `better-writing`, `better-ui` |
| interfaces.dev a11y pass | keyboard, WCAG, forms | `better-accessibility` |
| User asks interface review / explain UI | PR, branch, screenshot | `interface-review`, `explain-interface` (user-invoked only) |
| UI anti-slop / related-link hygiene | redundant secondary nav, modal density | `antislop-ui`, `DESIGN.md` Delivery gate |
| Code slop / duplication scan | PR cleanup, agent-written modules | `code-humanizer`, `code-slop` (report-first) |
| Whole-codebase untangle | User asks untangle / structural refactor | `untangle-codebase` (user-invoked only; ask Comments/Tests first) |
| Dashboard KPIs, charts, pickers, wordless UI | `frontend/src/pages/Dashboard*`, `**/observability/**`, audit UX docs | `dashboard-design` — KPI, charts, QA screenshots |
| Static/export dashboard prototypes, bento HTML | One-off HTML boards, report embeds | `awesome-dashboard-skill` — data contract, themes (not primary React shell) |
| Full-stack audit / SRS closure | `docs/audit/**`, user asks audit | `application-audit-completion` |
| Security review / hardening pass | Auth, admin, exports, credentials | `security-audit` |
| Bugs / regressions | Failing tests, prod-like bug | `systematic-debugging`; add `test-driven-development` if fixing logic |
| Ship / demo video | Marketing clip from repo | `brag` (optional) |
| Verification | Before claiming done | `verification-before-completion` |
| MeitY / GTIA / global-to-India product hunt | opportunity hunt, India occupancy, `artifacts/global_to_india_product_discovery/**` | `.cursor/rules/gtia-product-hunt.mdc`; spec `docs/research/GTIA_CANONICAL_SPEC.md` |
| RPH recombinant paper hunt | `docs/PAPER_HUNT_MASTER_PROMPT.md`, `papers/**`, `experiments/**`, paper dedup | `docs/PAPER_PLAYBOOK.md`; skills `novelty-siege`, `claim-ladder`, `simulation-validity`, `dedup-gate`; agents under `.cursor/agents/paper-*` + matrix/siege/sim/claim/citation/rescue |

## Deferred in TeleScope app (Cursor may still use)

Read `.cursor/skills/future-reference/` before pulling deps into `package.json`:

- **Lenis** — landing/marketing only; never global on `/app/*`.
- **taste-skill** — greenfield marketing HTML (`npx skills add` outside repo).
- **moveable** — layout editors; bento stays **@dnd-kit**.
- **Whiteboard stack** — see `docs/product/COLLABORATION_WHITEBOARD.md`; Phase 1 = incident + chart link, not Miro.
- **elastic/eui** — heavy DS; existing React + `chartTheme.js`.
- **scroll-craft / epic-design / claude-design** — cinematic landings only; never pin/scrub/parallax inside `/app/*`.
- **impeccable `overdrive` / `delight` on ops** — prefer `polish` / `quieter` / `harden` / `adapt` for the console.

## After reading a skill

1. Match existing patterns in repo (e.g. `@dnd-kit` on bento, `chartTheme.js`, RBAC helpers).
2. **Ponytail:** no new npm/MCP unless skill or user explicitly requires it.
3. Document install source in `docs/agent-skills/README.md` if you add a skill.

Catalog details: `docs/agent-skills/SKILL_CATALOG.md`.
