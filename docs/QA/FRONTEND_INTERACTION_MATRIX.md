# Frontend interaction matrix

Source: grep of `frontend/src/pages` buttons + `frontend/src/services/api.js`. **Browser clicks: BLOCKED this cycle.** Classification = code wiring, not live click.

| Surface | Actions | API / nav | Class |
| --- | --- | --- | --- |
| Login | Submit, captcha, MFA, forgot link, show password | `login`, `loginMfa` | WORKING (API) |
| Register | Submit | `register` | WORKING (API) |
| Forgot / reset | Submit | `forgotPassword`, `resetPassword` | WORKING (API) |
| Overview KPIs | Nav to health, telemetry, queues | `navigate` | WORKING (code) |
| Operator console | Lane links, refresh | `getOperationsCentre` | WORKING (code); 500 fixed QT-02 |
| Backend inventory | Search, filters, wizard, open details | `getBackends`, admin credentials | WORKING (code) |
| Backend details | Tabs, qubit table, pagination | qubits/calibration/topology | WORKING (code) |
| Telemetry pages | Time/backend filters, charts | calibration, drift, replay, anomalies | WORKING (code); live QPU BLOCKED |
| Timeline | Kind chips, details, nav | `getOpsTimeline` | WORKING (code) |
| Jobs / queues | Status chips, details | `getJobs`, `getQueues` | WORKING (code); no job submit in TeleScope UI |
| Alerts | Ack, resolve, bulk, incidents | alert/incident APIs | WORKING (code); RBAC API PASS |
| Reports | Generate, ask, snapshot | reports/evidence | WORKING (code); download untested |
| Settings | Profile, MFA enroll, password, sessions | users/me/* | WORKING (code) |
| Admin | Users, rules, collectors, tokens | `/admin/*` | WORKING (code); UI Admin-only |

No `coming soon` / `lorem ipsum` in `frontend/src`. Decorative `placeholder=` on inputs is form UX, not dummy copy.
