# Q-TeleScope complete frontend audit

**Date:** 2026-11-10  
**Phase:** 1 — audit only (no application source changes in this deliverable)  
**Auditor:** Cursor agent (repository + build + **partial live UI** via Playwright capture)

---

## 1. Executive summary

Q-TeleScope is a **React 19 + Vite 8 + React Router 7** enterprise ops frontend with **~35 lazy `/app/*` routes**, shared observability components, and ECharts-based analytics. The codebase shows **recent quality work** (shell density CSS, lazy ECharts, Platform health operator trim, dependency graph sizing, calibration event paging) but **does not yet feel like one cohesive Cert-level product**.

**Top launch risks**

1. **P0** — Raw collector errors in operator console titles (`OperationsCentre.jsx`).
2. **P1** — Typography system split (16px shell vs 12–13px tables; shrinking page titles at 1366px).
3. **P1** — Pagination gaps (queue history; alerts/client fetch model).
4. **P1** — “Custom date range” is **hours lookback**, not calendar range — product/docs mismatch.
5. **P1** — Secondary navigation still implemented as **`btn-secondary` strips** in drawers and several pages.
6. **Evidence gap** — **9 desktop/light screenshots** + computed typography on Alerts; dark/mobile/viewport matrix still open.

**Deliverables**

| Document | Path |
| --- | --- |
| This report | `docs/quality/QTELESCOPE_COMPLETE_FRONTEND_AUDIT.md` |
| Repair backlog | [QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md](./QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md) |
| Visible text | [QTELESCOPE_VISIBLE_TEXT_INVENTORY.md](./QTELESCOPE_VISIBLE_TEXT_INVENTORY.md) |
| Routes | [QTELESCOPE_ROUTE_INVENTORY.md](./QTELESCOPE_ROUTE_INVENTORY.md) |
| Typography | [QTELESCOPE_TYPOGRAPHY_AUDIT.md](./QTELESCOPE_TYPOGRAPHY_AUDIT.md) |
| Layout | [QTELESCOPE_LAYOUT_ALIGNMENT_AUDIT.md](./QTELESCOPE_LAYOUT_ALIGNMENT_AUDIT.md) |
| Components | [QTELESCOPE_COMPONENT_AUDIT.md](./QTELESCOPE_COMPONENT_AUDIT.md) |
| Tables | [QTELESCOPE_TABLE_AND_PAGINATION_AUDIT.md](./QTELESCOPE_TABLE_AND_PAGINATION_AUDIT.md) |
| Modals/drawers | [QTELESCOPE_MODAL_DRAWER_AUDIT.md](./QTELESCOPE_MODAL_DRAWER_AUDIT.md) |
| Navigation | [QTELESCOPE_NAVIGATION_ACTION_AUDIT.md](./QTELESCOPE_NAVIGATION_ACTION_AUDIT.md) |
| Responsive/a11y | [QTELESCOPE_RESPONSIVE_ACCESSIBILITY_AUDIT.md](./QTELESCOPE_RESPONSIVE_ACCESSIBILITY_AUDIT.md) |
| Functionality | [QTELESCOPE_FRONTEND_FUNCTIONALITY_AUDIT.md](./QTELESCOPE_FRONTEND_FUNCTIONALITY_AUDIT.md) |
| Performance | [QTELESCOPE_PERFORMANCE_AUDIT.md](./QTELESCOPE_PERFORMANCE_AUDIT.md) |
| Cert Studio | [QTELESCOPE_CERT_STUDIO_COMPARISON.md](./QTELESCOPE_CERT_STUDIO_COMPARISON.md) |
| Screenshots | [ui-audit/EVIDENCE_INDEX.md](./ui-audit/EVIDENCE_INDEX.md) (9 routes) |

---

## 2. Repository architecture

| Item | Detail |
| --- | --- |
| Framework | React **19.2.8**, react-dom, react-router-dom **7.18.5** |
| Build | Vite **8.3** (`frontend/vite.config.js`) |
| Entry | `frontend/src/main.jsx` → `App.jsx` |
| Routing | `appNav.js`, `appLazyPages.js`, nested `/app/*` shell |
| State | React context (`PageActionsContext`, theme, auth); page-local `useState` |
| API | `frontend/src/services/api` |
| Charts | ECharts 6 lazy via `QtECharts.jsx` |
| Icons | lucide-react |
| 3D | three / R3F present — **marketing / optional**, not ops console core |
| Global CSS | `index.css`, `app-shell-density.css`, `observability.css`, page CSS |
| Design direction | `docs/product/DESIGN.md` |

---

## 3. Route inventory

See [QTELESCOPE_ROUTE_INVENTORY.md](./QTELESCOPE_ROUTE_INVENTORY.md). **All routes mapped** from lazy page registry; **per-route visual audit status: code-only** unless noted in backlog.

---

## 4. Shared component inventory

See [QTELESCOPE_COMPONENT_AUDIT.md](./QTELESCOPE_COMPONENT_AUDIT.md). Highlights: **`EnterpriseDataTable`** is the main table chrome but **client-only**; **`ListPager`** minimal; **`ContextBar` / `TelemetryWindowControl`** own time scope.

---

## 5. Global typography assessment

See [QTELESCOPE_TYPOGRAPHY_AUDIT.md](./QTELESCOPE_TYPOGRAPHY_AUDIT.md).

**Summary:** Shell body at **16px** fights **12/13px tables** and **15–16px page titles**. Cert Studio reference implies **comfortable 15px+ body** with **1.5 line-height** — tables currently violate that. Chart axis fonts often **9–11px** in page options.

---

## 6. Global layout and alignment

See [QTELESCOPE_LAYOUT_ALIGNMENT_AUDIT.md](./QTELESCOPE_LAYOUT_ALIGNMENT_AUDIT.md).

**Summary:** `page-toolbar-unified` and `page-related-nav` exist but **coverage is incomplete**. Operator console and backend workspace remain highest misalignment debt.

---

## 7. Cert Studio comparison

See [QTELESCOPE_CERT_STUDIO_COMPARISON.md](./QTELESCOPE_CERT_STUDIO_COMPARISON.md). In-repo Cert assets are **marketing** — use for **density floor and rhythm**, not literal marketing type scale.

---

## 8. Page-by-page findings (condensed)

Scores are **audit judgments** (not metrics). **Evidence:** code + partial prior fixes; **screenshots pending**.

| Route | Visual | Type | Align | Func | Content | Responsive | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/app/overview` | 6 | 6 | 7 | 7 | 7 | 6 | Lazy dashboard chunk; KPI density OK |
| `/app/operate` | 5 | 5 | 5 | 6 | 4 | 6 | **UI-001** error text |
| `/app/platform/health` | 7 | 6 | 7 | 7 | 7 | 6 | Trimmed; graph verify |
| `/app/investigate/timeline` | 6 | 6 | 7 | 7 | 7 | 6 | EDT |
| `/app/backends/inventory` | 6 | 6 | 6 | 7 | 7 | 6 | — |
| `/app/backends/qubits` | 6 | 6 | 6 | 7 | 7 | 6 | Modal verify |
| `/app/backends/details/*` | 5 | 5 | 5 | 7 | 7 | 5 | Toolbar fragmentation |
| `/app/telemetry/*` (11 routes) | 6 | 5 | 6 | 7 | 6 | 6 | Hours not date range |
| `/app/execution/jobs` | 6 | 6 | 7 | 7 | 7 | 6 | EDT |
| `/app/execution/queues` | 5 | 6 | 6 | 6 | 7 | 6 | **No history pager** |
| `/app/resources/*` | 6 | 6 | 5 | 7 | 7 | 6 | Capabilities grid |
| `/app/alerts` (+ incidents) | 6 | 6 | 5 | 7 | 6 | 5 | Drawer btn nav |
| `/app/reports` | 6 | 6 | 7 | 7 | 7 | 6 | — |
| `/app/settings` | 7 | 7 | 7 | 7 | 7 | 7 | Coherent page CSS |
| `/app/admin/*` | 6 | 5 | 6 | 7 | 6 | 5 | RBAC matrix |
| `/app/onboarding` | 7 | 7 | 7 | 7 | 6 | 7 | Watch marketing tone |
| `/login` | 7 | 7 | 7 | — | 7 | 7 | Not fully audited |

---

## 9. Visible text issues

See [QTELESCOPE_VISIBLE_TEXT_INVENTORY.md](./QTELESCOPE_VISIBLE_TEXT_INVENTORY.md). **P0:** dynamic error injection in operator console.

---

## 10. Tables and pagination

See [QTELESCOPE_TABLE_AND_PAGINATION_AUDIT.md](./QTELESCOPE_TABLE_AND_PAGINATION_AUDIT.md).

---

## 11. Modals and drawers

See [QTELESCOPE_MODAL_DRAWER_AUDIT.md](./QTELESCOPE_MODAL_DRAWER_AUDIT.md).

---

## 12. Navigation and actions

See [QTELESCOPE_NAVIGATION_ACTION_AUDIT.md](./QTELESCOPE_NAVIGATION_ACTION_AUDIT.md).

---

## 13. Charts and graphs

- **ECharts:** lazy-loaded; many pages set small axis fonts.
- **DependencyGraph:** ResizeObserver + toolbar — verify clipping fix.
- **Topology explorer:** reported spacing issues — **NEEDS_VERIFICATION**.
- **Pipeline viz:** 2D ops path per product direction (no 3D ops console).

---

## 14. Responsive findings

See [QTELESCOPE_RESPONSIVE_ACCESSIBILITY_AUDIT.md](./QTELESCOPE_RESPONSIVE_ACCESSIBILITY_AUDIT.md). **Not tested** across required viewports in this run.

---

## 15. Accessibility findings

Partial: EDT aria labels present; **dark table headers hardcoded light**; **btn--xs** touch targets; chart canvas SR limitations.

---

## 16. Functionality findings

See [QTELESCOPE_FRONTEND_FUNCTIONALITY_AUDIT.md](./QTELESCOPE_FRONTEND_FUNCTIONALITY_AUDIT.md). No live click-through in this audit pass.

---

## 17. Performance findings

See [QTELESCOPE_PERFORMANCE_AUDIT.md](./QTELESCOPE_PERFORMANCE_AUDIT.md). Build: **index 135KB gzip**, echarts **379KB gzip async**.

---

## 18. Known issue verification (§15)

Full table in [QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md](./QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md#known-issue-checklist-15).

---

## 19. Prioritised repair backlog

**22 tracked items** — [QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md](./QTELESCOPE_FRONTEND_REPAIR_BACKLOG.md).

---

## 20. Recommended implementation sequence

1. **P0** UI-001 sanitize operator errors + error display layer.
2. **Typography tokens** UI-002, UI-013, UI-016 (shell + tables + chartTheme).
3. **Shared pagination** UI-006, UI-003, UI-007 (queue + server strategy).
4. **Navigation chrome** UI-005, UI-014 (`page-related-nav` migration).
5. **Backend workspace / metrics explorer** UI-008 toolbars.
6. **Platform health + graphs** verify UI-011, UI-014 dependency graph.
7. **Modals** UI-010, UI-021 standard xl layouts.
8. **Admin RBAC** UI-012.
9. **Performance measure** UI-020 Lighthouse + API waterfall.
10. **Responsive/a11y pass** UI-015 + viewport screenshot matrix.
11. **Copy** complete TXT inventory script + ChartPanel questions.

---

## 21. Blocked items and limitations

| Blocker | Impact |
| --- | --- |
| Dark / mobile / multi-viewport matrix | Not captured yet |
| Cert Studio full app not in repo | Benchmark = marketing CSS only |
| Full text inventory | Sample + chart `question` grep; needs AST pass |
| Backend not profiled | API latency findings speculative |
| Drawer/modal open states | Not screenshot yet |

**Complete evidence:** `cd tests/e2e && npx playwright test --project=audit-capture` (extend spec for dark + viewports) → revisit `NEEDS_VERIFICATION` backlog rows.

---

## 22. Evidence index

| Evidence type | Location |
| --- | --- |
| Production build sizes | This doc §17; `QTELESCOPE_PERFORMANCE_AUDIT.md` |
| Source line defects | Repair backlog source file column |
| Screenshots | `docs/quality/ui-audit/` (**empty**) |
| Prior repair tracker | `docs/quality/UI_REPAIR_CHECKLIST.md` (may overlap) |
| Design intent | `docs/product/DESIGN.md` |

---

## What was inspected vs unverified

**Inspected (static + partial live):** Full route map, table/pagination patterns, typography CSS **and computed samples**, key known-issue code paths, production build, **9 route screenshots**, component inventory.

**Unverified (needs runtime):** Remaining routes, 8 viewports × dark theme, modal/drawer open states, graph layout click tests, Lighthouse, keyboard a11y, exhaustive visible strings.
