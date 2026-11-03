# Q-TeleScope — UX Design System Specification (Target State)

**Baseline (SRC):** `frontend/src/index.css`, `ThemeProvider`, Lucide icons, ECharts 6  
**Target:** WCAG 2.2 AA-oriented semantic tokens ([WCAG 2.2](https://www.w3.org/TR/WCAG22/))

---

## 1. Design principles

1. **Operational clarity** over decoration — no fake live animations.  
2. **Provenance visible** — every data surface shows source, age, quality.  
3. **Modality-safe** — no cross-modality averages without explicit compatibility badge.  
4. **Advisory vs authoritative** — health/quarantine visually distinct from vendor scheduler state.  
5. **Accessible by default** — focus, contrast, non-color status ([WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)).

---

## 2. Semantic color tokens (proposed)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--surface-canvas` | `#f8fafc` | `#070a0f` | Page bg (maps existing `--bg-dark`) |
| `--surface-raised` | `#ffffff` | `#0d121d` | Cards (`--bg-card`) |
| `--surface-sidebar` | `#ffffff` | `#090d16` | Nav |
| `--text-primary` | `#0f172a` | `#f8fafc` | Body |
| `--text-muted` | `#64748b` | `#94a3b8` | Secondary |
| `--border-subtle` | `#cbd5e1` | `#1e293b` | Dividers |
| `--status-ok` | `#059669` | `#34d399` | Operational OK |
| `--status-warn` | `#d97706` | `#fbbf24` | Degraded / stale |
| `--status-critical` | `#e11d48` | `#fb7185` | Critical / RED |
| `--status-unknown` | `#64748b` | `#94a3b8` | Missing data |
| `--data-live` | `#0284c7` | `#38bdf8` | Verified live collection |
| `--data-simulated` | `#7c3aed` | `#a855f7` | Mock/simulated |
| `--focus-ring` | `#2563eb` | `#60a5fa` | 2px outline offset 2px |

**Rule:** Charts/tooltips use semantic tokens only — remove hardcoded `#ffffff` tooltips (`LiveTelemetry.jsx` **SRC**).

---

## 3. Typography

| Role | Family | Size | Weight |
|------|--------|------|--------|
| UI body | Inter, system-ui | 14px (13.5 today) | 400 |
| Page title | Inter | 20–24px | 600 |
| KPI value | Inter | 28–32px | 700 |
| Mono (IDs, hashes) | JetBrains Mono | 12–13px | 500 |

Line height: 1.5 body; 1.2 KPIs.

---

## 4. Layout

| Element | Spec |
|---------|------|
| Sidebar expanded | 260px (current) |
| Sidebar collapsed | 64px icon rail |
| Header | 56px — title + global context + freshness |
| Content max-width | 1440px optional on wide analytics |
| Card padding | 16px default; 12px dense tables |
| Grid gap | 10–16px (current 10px OK) |

---

## 5. Shell components (build)

| Component | Responsibility |
|-----------|----------------|
| `AppShell` | Sidebar + header + outlet |
| `GlobalContextBar` | Site, backend, time range |
| `DataProvenanceChip` | live/sim/stale/unknown + age |
| `PlatformHealthBadge` | collectors OK / degraded |
| `Breadcrumbs` | URL-driven |
| `NotificationToast` | ack success/failure |
| `ConfirmDialog` | destructive ops (quarantine, delete rule) |

---

## 6. Tables (capability tiers)

| Tier | Pages | Features |
|------|-------|----------|
| T1 Basic | Metrics coverage | sort, empty state |
| T2 Operational | Jobs, alerts, backends | filter, pagination, row actions |
| T3 NOC | Incidents, ops centre exceptions | sticky header, bulk ack, export CSV |

Keyboard: row focus, Enter opens drawer.

---

## 7. Charts (ECharts wrapper)

Standard props: `metricId`, `unit`, `timeWindow`, `aggregation`, `modalityScope`, `stalenessMax`, `showCalibrationMarkers`, `accessibilityTableExport`.

**Tooltip template:** `{metric} · {value}{unit} · {timestamp} · source: {provenance} · age: {seconds}s`

---

## 8. Motion

- Respect `prefers-reduced-motion` — disable pulse dot on IST clock when set.  
- SSE chart updates: max 1 redraw/5s; no flashing badges.

---

## 9. Microcopy replacements

| Avoid | Use |
|-------|-----|
| Live | Platform refresh (5s) · last measurement {age} |
| Healthy | Readiness: GREEN (advisory) |
| Quarantine | Mark qubit advisory-offline (local) |
| Connected | Collectors: 3/4 OK |

---

## 10. High-contrast mode (Phase 1+)

Optional `.high-contrast` theme: 7:1 text, borders 2px, no shadow-only separation.
