# Q-TeleScope frontend functionality audit

**Interaction testing:** NOT COMPLETED in automated run (no logged-in browser session).

## Build / compile

- `npm run build` — **PASS** (2026-11-10): shell ~442KB / 135KB gzip; echarts async ~1.14MB.

## Code-level functional risks

| ID | Area | Finding |
| --- | --- | --- |
| FUNC-01 | Operator console | Collector queue titles embed `p.error` raw (`OperationsCentre.jsx` ~207) — **SQL/API errors visible** |
| FUNC-02 | Queue history | Renders all history rows without pager |
| FUNC-03 | Alerts | Client-side pagination after full fetch — may break with large datasets |
| FUNC-04 | Telemetry time | Custom lookback = hours number, not datetime range — product expectation mismatch |
| FUNC-05 | API errors | Many pages `.catch(() => setPayload(null))` — silent empty vs error state |

## Console / network (to measure)

- [ ] Login → dashboard: duplicate `/api/backends`, `/api/...` on mount
- [ ] OperationsCentre staged `Promise.allSettled`
- [ ] Platform health without removed admin-only endpoints (post-trim)

## Tests in repo

- `EnterpriseDataTable.test.jsx` — table kit behaviour
- Broader E2E: **not found** in quick search — gap for launch
