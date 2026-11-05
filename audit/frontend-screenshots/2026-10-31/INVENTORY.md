# Screenshot inventory — 2026-10-31

**Capture method:** Playwright headless Chromium, viewport 1440×900 (full page), plus dark dashboard and 768×1024 tablet dashboard.  
**Auth:** Admin session injected via `localStorage.quantum_user` (audit bypass; login captcha not exercised).  
**Base URL:** `http://127.0.0.1:5173`  
**Backend:** `http://127.0.0.1:8000` (live mock catalog, 4 backends, ~100 active alerts in DB).

| File | Route | Notes |
|------|-------|--------|
| `00-landing-1440x900.png` | `/` | Public marketing |
| `02-login-1440x900.png` | `/login` | Captcha + marketing chrome |
| `03-register-1440x900.png` | `/register` | |
| `01-dashboard-light-1440x900.png` | `/app` | Default light |
| `01-dashboard-dark-1440x900.png` | `/app` | After theme toggle |
| `01-dashboard-tablet-768.png` | `/app` | 768×1024 |
| `01-dashboard-light-viewport.png` | `/app` | Viewport capture (partial) |
| `04-operations-centre-1440x900.png` | `/app/operations` | Centre tab |
| `05-platform-health-1440x900.png` | `/app/operations/health` | |
| `06-ops-timeline-1440x900.png` | `/app/operations/timeline` | |
| `07-backend-inventory-1440x900.png` | `/app/backends/inventory` | |
| `08-qubit-monitoring-1440x900.png` | `/app/backends/qubits` | |
| `09-backend-details-1440x900.png` | `/app/backends/details/ibm_brisbane` | |
| `10-live-telemetry-1440x900.png` | `/app/telemetry/live` | |
| `11-calibration-status-1440x900.png` | `/app/telemetry/calibration` | |
| `12-drift-analysis-1440x900.png` | `/app/telemetry/drift` | |
| `13-historical-trends-1440x900.png` | `/app/telemetry/trends` | |
| `14-topology-explorer-1440x900.png` | `/app/telemetry/topology` | |
| `15-cal-timeline-1440x900.png` | `/app/telemetry/cal-timeline` | |
| `16-backend-compare-1440x900.png` | `/app/telemetry/compare` | |
| `17-anomaly-monitor-1440x900.png` | `/app/telemetry/anomalies` | |
| `18-temporal-replay-1440x900.png` | `/app/telemetry/replay` | |
| `19-metrics-telemetry-1440x900.png` | `/app/telemetry/metrics` | |
| `20-job-monitoring-1440x900.png` | `/app/execution/jobs` | |
| `21-queue-monitoring-1440x900.png` | `/app/execution/queues` | |
| `22-resource-health-1440x900.png` | `/app/resources/health` | Health vector + module badges |
| `23-environment-1440x900.png` | `/app/resources/environment` | |
| `24-metrics-resources-1440x900.png` | `/app/resources/metrics` | Same component as telemetry metrics |
| `25-alerts-1440x900.png` | `/app/alerts` | |
| `26-incidents-1440x900.png` | `/app/alerts/incidents` | |
| `27-reports-1440x900.png` | `/app/reports` | |
| `28-administration-1440x900.png` | `/app/admin` | |

**Not captured:** Modal open states (Admin add rule), detail drawers, filter-expanded states, empty DB, loading skeleton mid-flight, register/login success path, phone (~390px) viewport, axe scan output.
