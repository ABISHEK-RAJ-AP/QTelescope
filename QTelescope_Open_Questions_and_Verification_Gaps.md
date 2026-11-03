# Q-TeleScope — Open Questions and Verification Gaps

**Purpose:** Blockers and `NEEDS_VERIFICATION` items before/during P0 implementation.

## Runtime verification gaps (not re-run this session)

| ID | Item | Impact | Suggested verification |
| -- | ---- | ------ | ---------------------- |
| V1 | Full route screenshot pass at 1440 / 768 / 390 | Responsive acceptance | Playwright like `audit/frontend-screenshots/2026-10-31/` |
| V2 | Login captcha success path | Auth UX | Manual or E2E |
| V3 | Empty database (no backends) | Empty states | Seed reset + navigate all routes |
| V4 | `GET /queues/analytics/summary` schema (histogram bins?) | Queue viz P1 | Inspect OpenAPI or sample JSON |
| V5 | `POST /health/compare` eligibility rules | Compare UX copy | Read `app/api/health.py` + tests |
| V6 | SSE `/events/stream` payload interval vs collector schedule | Live Telemetry honesty | Log timestamps in browser |
| V7 | Alerts page with no `status` filter — user sees resolved? | Alert trust | `AlertsEvents.jsx` load all |
| V8 | Federated summary on Operations when federation disabled | Empty vs error | Config + runtime |
| V9 | Evidence snapshot manifest fields | Reports preview | Download sample ZIP |
| V10 | Role matrix beyond Admin gate | RBAC UI | `app/core/rbac.py` vs FE |

## Product decisions required (human)

| ID | Question | Options | Recommendation |
| -- | -------- | ------- | -------------- |
| P1 | Fleet-wide Qubit page after workspace? | Keep `/fleet/qubits` vs tab-only | **Tab-only** unless cross-backend sort is required |
| P2 | Sidebar badge: critical vs all active? | Critical only vs total active | **Critical** for badge; show total in Operate |
| P3 | Records route prefix | `/app/alerts` legacy vs `/app/record/*` | Redirect legacy |
| P4 | Evidence “Ask assistant” prominence | Keep vs demote | Demote — not primary evidence |
| P5 | Dashboard bento default for all users? | Keep customize | Keep; default = 2-col not bento |

## Technical contradictions to resolve in P0

| ID | Issue | Evidence | Resolution |
| -- | ----- | -------- | ---------- |
| T1 | Multiple “alert” numbers | Matrix + `App.jsx` sidebar vs Dashboard critical | Document + UI labels “Critical (ACTIVE)” vs “Active (all severities)” |
| T2 | `getAlerts()` on Alerts page without status | `AlertsEvents.jsx` | Default `status=ACTIVE` or explicit tabs |
| T3 | Metrics duplicate routes | `App.jsx` resources.metrics + telemetry.metrics | Redirect |
| T4 | Backend Details tab not in URL | `BackendDetails.jsx` internal state | Workspace routes |
| T5 | Mock backends in fleet counts | `operations.py` `simulated_catalog` | Show in Fleet Summary separately |

## Backend gaps (if UI needs them)

| Feature | UI need | Backend status | Label |
| ------- | ------- | -------------- | ----- |
| Fleet health time series | Overview trend | No dedicated endpoint found | `BACKEND_CHANGE` |
| Global search | P3 | No search API | `NOT_SUPPORTED` |
| Alert → telemetry deep link server | Optional | Client-only feasible | `FRONTEND_CHANGE` |
| DLQ UI | Collectors page | `GET /admin/collector-dlq` exists | `FRONTEND_CHANGE` |
| Live facility MQTT | Environment | `getFacilityMqttStatus` — stub? | Verify adapter |

## Test / build commands (verified)

| Command | Location | Label |
| ------- | -------- | ----- |
| `npm run build` | `frontend/` | `VERIFIED` in prior sessions |
| `npm run lint` | `frontend/` (oxlint) | `VERIFIED` script exists |
| Backend pytest | `tests/` | Exists; count not re-run this session |

## References

- Prior blueprint: `QTelescope_Comprehensive_UI_Product_Redesign_Blueprint.md`
- Audit: `QTelescope_Frontend_UX_UI_Audit.md`
- Screenshots: `audit/frontend-screenshots/2026-10-31/INVENTORY.md`
