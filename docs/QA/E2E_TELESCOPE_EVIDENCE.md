# TeleScope Playwright evidence — 2026-11-09

**Environment:** local lab — API `127.0.0.1:8000`, Vite `127.0.0.1:5173`  
**Flags:** `scripts/start-e2e-api.sh` (`REQUIRE_API_AUTH=true`, `ENFORCE_RBAC=true`), `E2E_PLAYWRIGHT=1`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`, `PW_WORKERS=1`

## Result

| Outcome | Count |
| --- | --- |
| Passed | **28** (2026-11-09 full gate `scripts/run-e2e-telescope.sh`, 3.9m) |
| Skipped | **2** (E21 second session, E23 deep-route refresh) |
| Failed | **0** |

**Catalogue size:** **30** tests across `telescope-*.spec.ts` (E01–E26; E22 duplicated in 3 files).  
**Gate:** `≥22 passed`, `≤6 skipped`, `0 failed` — **met** (E25, E26 included in pass set).

Command:

```bash
cd tests/e2e && npm install
cd ../.. && E2E_CAPTCHA_BYPASS=1 PERSIST_API_SESSIONS=true PYTHONPATH=. uvicorn app.main:app --port 8000
cd frontend && npm run dev
cd tests/e2e && E2E_PLAYWRIGHT=1 E2E_CAPTCHA_BYPASS=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
  npx playwright test --project=telescope
```

## Fixes this wave

- Login helpers: `autocomplete` + captcha `aria-label` (AuthShell labels not wired to inputs).
- Inventory journeys: wait for `data-tour="page-inventory"`; grid vs table workspace open.
- E20: logout confirm dialog (not raw `localStorage` clear).
- `playwright.config.ts`: optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; default `workers=1`.

## Skips (expected in lab)

- E22 when `REQUIRE_API_AUTH=false`.
- **E21** (multi-session): needs `PERSIST_API_SESSIONS=1` (or stack default that keeps ≥2 active sessions) plus revoke/list API reachable from test user.
- **E23** (deep-route refresh): needs at least one backend with calibration snapshot so `data-tour="page-backend-calibration"` hydrates after hard refresh on `/backends/:id`.
- Journeys that call `test.skip` when data empty (export, evidence generate).
