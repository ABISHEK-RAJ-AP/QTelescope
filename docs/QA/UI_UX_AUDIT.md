# UI/UX audit vs Cert Studio

Reference: `apps/studio/src/cert-studio/*`, `apps/shared/qre-theme/cert-studio/`.

## Principles to keep (not clone)

- Clear page hero + one primary action.
- Cyan focus rings on forms (`AuthShell` already close).
- Loading/empty components (`BoneyardSkeleton`, `EmptyState`).
- Dark/light tokens.

## Do not copy

- Marketing particle/fridge scenes on ops pages.
- Studio “Build” vocabulary on Observe/Execute.

## Code-level quality

- Shared `PageHeader`, `ErrorState`, `RefreshButton`, toast host.
- Ops console CSS (`OperationsCentre.css`) after prior alignment work.
- Charts: ECharts + `QtECharts` / `ChartPanel`.

## Unverified visually this cycle

Alignment, overflow, card heights, 9 viewports — **BLOCKED** (no browser screenshots). Treat as incomplete, not pass.
