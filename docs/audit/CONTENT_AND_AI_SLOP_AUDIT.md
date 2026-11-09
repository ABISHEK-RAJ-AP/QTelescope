# Content and AI-slop audit

**Status:** In progress (Stage C started 2026-11-09)  
**Method:** ripgrep for marketing phrases; manual review of shared shells; page-specific copy ongoing.

## Scan summary

| Pattern | `frontend/src` hits (marketing) | Notes |
| --- | ---: | --- |
| powerful / seamless / unlock / revolutionary | 0 | — |
| Welcome to your dashboard | 0 | Fleet overview used |
| Generic EmptyState "Nothing to show yet" | **Fixed** | → `constants/messages.js` |
| Generic ErrorState "Could not load data" | **Fixed** | → `Unable to load` + guidance |
| ChartPanel "No data for this selection" | **Fixed** | → measurement-specific default |

## Corrections applied (verified in code)

| ID | Location | Was | Now | Verify |
| --- | --- | --- | --- | --- |
| C-001 | `EmptyState.jsx` defaults | No data / Nothing to show yet | No records / Nothing matches… | Vitest EDT tests |
| C-002 | `ErrorState.jsx` defaults | Could not load data | Unable to load + retry path | visual |
| C-003 | `ChartPanel.jsx` empty | No data for this selection | No measurements for range… | component |
| C-004 | `backendUtils.js` age label | No data | Not available | inventory pages |
| C-005 | `BackendComparison.jsx` | emptyTitle No data (×3) | No measurements | compare charts |
| C-006 | `TemporalReplay.jsx` KPI | no data | Not available | replay |
| C-007 | `apiErrors.js` | (already operator-safe) | — | `apiErrors.test.js` |

## Open content debt (P2 — next passes)

| ID | Location | Issue | Target |
| --- | --- | --- | --- |
| C-010 | Alerts grouped table | Repeated "Open workspace" | Keep; verify action works (E10 skipped) |
| C-011 | `LayoutCustomizeToggle.jsx` | Smart fill | **Fixed** → Suggested layout |
| C-012 | 18+ page modules | `Failed to load` vs `Unable to load` | **Mostly fixed** — `unableToLoad()` in `messages.js` |
| C-013 | Backend admin | `Some data failed to load: …` | List sections + retry per section |
| C-014 | Exports / PDF | Not audited | Phase 12 |
| C-015 | Backend API `detail` strings | Partial audit | Map in BACKEND_AND_API_AUDIT |

## Voice rules (enforced incrementally)

1. Name the resource in errors (`Backend registry failed to load` — already used on inventory).
2. Separate reachability, freshness, and quality (see [TERMINOLOGY.md](TERMINOLOGY.md)).
3. No success toast before API 2xx (audit workflows in Phase 8).

## Content quality gate (for PRs)

- [ ] Button label = actual action
- [ ] Empty state explains filter/scope, not generic "no data"
- [ ] Errors: what failed + next step
- [ ] Units on measurements
- [ ] Simulated vs live labeled (ProvenanceChip / lineage)
