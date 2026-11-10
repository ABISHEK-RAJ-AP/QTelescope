# UI audit evidence index

**Session:** 2026-11-10 · SuperAdmin · ~1280×720 default Chromium · **light theme**  
**API:** `E2E_CAPTCHA_BYPASS=1` on `:8000` (lab only)  
**Capture command:** `cd tests/e2e && E2E_CAPTCHA_BYPASS=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test --project=audit-capture`

| File | Route | Notes |
| --- | --- | --- |
| [login-blocked-captcha-desktop.png](./login-blocked-captcha-desktop.png) | `/login` | Before bypass restart |
| [dashboard-desktop-light.png](./dashboard-desktop-light.png) | `/app/overview` | Prior session |
| [operator-console-desktop-light.png](./operator-console-desktop-light.png) | `/app/operate` | List mode |
| [admin-role-matrix-desktop-light.png](./admin-role-matrix-desktop-light.png) | `/app/admin/users` | Users EDT |
| [platform-health-desktop-light.png](./platform-health-desktop-light.png) | `/app/platform/health` | Dependency graph section visible |
| [queue-monitoring-desktop-light.png](./queue-monitoring-desktop-light.png) | `/app/execution/queues` | Check history table length in image |
| [calibration-events-pagination-desktop-light.png](./calibration-events-pagination-desktop-light.png) | `/app/telemetry/cal-timeline` | Events pager 25/page |
| [alerts-desktop-light.png](./alerts-desktop-light.png) | `/app/alerts` | EDT + filters |
| [backend-inventory-desktop-light.png](./backend-inventory-desktop-light.png) | `/app/backends/inventory` | Fleet table |

## Computed typography (Chromium, `/app/alerts` after load)

| Element | font-size | weight | line-height | font-family |
| --- | --- | --- | --- | --- |
| `h1` | **23.76px** | **800** | 35.64px | Inter |
| `.page-stack` | **17.6px** | 400 | 26.4px | Inter |
| `.custom-table th` | **12px** | **700** | 18px | Inter |
| `.custom-table td` | **13px** | 400 | 19.5px | Inter |

**Finding:** App shell body (~17.6px) vs table cells (13px) — **4.6px gap** confirms typography audit; `h1` uses app head style, not `.page-title` (16px CSS).

## Not yet captured

- Dark theme variants (`Toggle theme` then re-run `audit-capture`)
- Viewports 1366 / 1024 / 390 (set `page.setViewportSize` in capture spec)
- Dependency graph **full scroll** crop (`dependency-graph-full-view.png`)
- Alert **drawer** open state
- Qubit **InsightModal** xl
