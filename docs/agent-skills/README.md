# Agent skills (Q-TeleScope)

Curated skills/rules for Cursor on this repo. Upstream clones live under `.vendor/skills-upstream/` (gitignored).

## Installed in-repo

| Source | Path | Use when |
| --- | --- | --- |
| **Skill router** | `.cursor/rules/skill-router.mdc` | Always — pick the right skill before coding |
| [Karpathy guidelines](https://github.com/forrestchang/andrej-karpathy-skills) | `.cursor/rules/karpathy-guidelines.mdc` | Always — think first, small diffs |
| [Dashboard design](https://github.com/abdiraimov-otabek/dashboard-design-skill) | `.cursor/skills/dashboard-design/` | KPIs, charts, filters, wordless ops dashboards |
| [Awesome dashboard](https://github.com/shinwood/awesome-dashboard-skill) | `.cursor/skills/awesome-dashboard-skill/` | Single-file HTML/ECharts bento prototypes |
| [Cloudflare security-audit](https://github.com/cloudflare/security-audit-skill) | `.cursor/skills/security-audit/` | Full security audit / pen-test |
| [obra/superpowers](https://github.com/obra/superpowers) (subset) | `.cursor/skills/using-superpowers`, `test-driven-development`, `systematic-debugging`, `writing-plans`, `verification-before-completion` | Non-trivial features / debug |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `.cursor/skills/ui-ux-pro-max/` | UI polish, design system, density |
| [antislop](https://github.com/miqdadbadjuber/anti-slop) | `.cursor/skills/antislop/`, `antislop-ui/` | Anti-slop filter + UI rules; pair with `docs/product/DESIGN.md` |
| [code-humanizer](https://github.com/LeonardNJU/code-humanizer) | `.cursor/skills/code-humanizer/` | Structural code-slop scan (duplication, try-import, narrating comments) |
| [code-slop](https://github.com/benjaming/ai-skills) | `.cursor/skills/code-slop/` | Branch diff slop suggestions (comments, `any`, defensive noise) |
| [brag](https://github.com/latent-spaces/brag) | `.cursor/skills/brag/` | Optional launch / promo video from repo |

Full categorization (install vs defer: Lenis, whiteboard, taste-skill, EUI, …): [`SKILL_CATALOG.md`](./SKILL_CATALOG.md).

**Cursor-only (no TeleScope npm):** `.cursor/skills/future-reference/` — Lenis, taste-skill, moveable, whiteboard stubs; optional `./scripts/clone-future-skill-repos.sh`.

### UI UX Pro Max CLI

```bash
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "internal operations dashboard" --design-system -p "Q-TeleScope" --stack react
```

Requires Python 3.x (stdlib + local CSV data only).

## Optional (not bundled — large / other product)

| Repo | Why not vendored |
| --- | --- |
| [OpenMontage](https://github.com/OpenMontageInc/OpenMontage) | Agentic **video** pipeline (AGPL); use separately for marketing reels, not TeleScope runtime |
| Full superpowers | Install via `/add-plugin superpowers` in Cursor marketplace for complete skill set |

## Refresh upstream

```bash
./scripts/refresh-agent-skills.sh
# or: cd .vendor/skills-upstream/<repo> && git pull && re-copy per SKILL_CATALOG.md
```

First-time vendor clones (gitignored):

```bash
mkdir -p .vendor/skills-upstream
git clone --depth 1 https://github.com/abdiraimov-otabek/dashboard-design-skill.git .vendor/skills-upstream/dashboard-design-skill
git clone --depth 1 https://github.com/shinwood/awesome-dashboard-skill.git .vendor/skills-upstream/awesome-dashboard-skill
git clone --depth 1 https://github.com/darkroomengineering/lenis.git .vendor/skills-upstream/lenis   # reference only
./scripts/refresh-agent-skills.sh
```

## P0 programme status (perf + security)

See [`../audit/PERFORMANCE_AND_SECURITY_BACKLOG.md`](../audit/PERFORMANCE_AND_SECURITY_BACKLOG.md). **Done in-repo:** gzip, debounce, KPI animation, alerts summary context, auth + write rate limits, origin guard (prod CSRF-ish), stream tickets, admin RBAC, `run-dependency-audit.sh`, CI workflow `qtelescope-release-gates.yml`.

**Still infra / later:** CDN, Brotli at edge, OTel export, RUM, WebP build pipeline, full list virtualization.
