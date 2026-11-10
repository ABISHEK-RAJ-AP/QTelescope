# Q-TeleScope performance audit (frontend)

Canonical build numbers: also see [../performance/QTELESCOPE_PERFORMANCE_AUDIT.md](../performance/QTELESCOPE_PERFORMANCE_AUDIT.md).

## Measured (production build)

| Metric | Value | Notes |
| --- | --- | --- |
| Initial JS (index) | 442.46 KB min / **135.23 KB gzip** | Router, shell, providers |
| ECharts chunk | 1,141.70 KB min / **379.30 KB gzip** | **Async** via `QtECharts` lazy import |
| Dashboard route chunk | 75.23 KB / 23.66 KB gzip | Lazy |
| Build time | ~2s | Local |

## Implemented optimisations (already in tree)

- Lazy `echarts-for-react` in `QtECharts.jsx` (PERF-01).

## Not measured (honest gap)

- LCP, INP, CLS — **no Lighthouse run in this audit**
- API p95 — backend not profiled here
- Rerender hotspots — no React Profiler capture

## Likely remaining issues

| Issue | Evidence |
| --- | --- |
| Slow “felt” load | Large shell + many lazy routes still parse on first navigation; demo API latency |
| Heavy pages | `AlertsEvents`, `AdministrationPage`, `BackendDetails` chunk sizes |
| Polling / refresh | Per-page refresh buttons — interval usage **per-page audit needed** |

## Verification plan (Phase 2)

1. Lighthouse CI on `/login` → `/app/overview` and `/app/platform/health`
2. Network tab: count API calls first 10s on Operations + Platform health
3. Compare before/after any bundle diet (avoid eager graph libs)
