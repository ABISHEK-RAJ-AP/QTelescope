# TeleScope Playwright evidence — 2026-11-09

**Environment:** local lab — API `127.0.0.1:8000`, Vite `127.0.0.1:5173`  
**Flags:** `scripts/start-e2e-api.sh` (`REQUIRE_API_AUTH=true`, `ENFORCE_RBAC=true`), `E2E_PLAYWRIGHT=1`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`, `PW_WORKERS=1`

## Result

| Outcome | Count |
| --- | --- |
| Passed | **22** (last full serial gate, Sprint 3 — see below) |
| Skipped | **6** (data-conditional + E21/E22 env) |
| Failed | **0** (`PW_WORKERS=1`) |

**Catalogue size:** **30** tests across `telescope-*.spec.ts` (E01–E26; E22 duplicated in 3 files).  
**After gate:** E25 (audit log), E26 (metrics explorer) added — **re-run required** before claiming Pass count.

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
- E21 when second session / revoke API preconditions missing.
- Journeys that call `test.skip` when data empty (export, evidence generate).
