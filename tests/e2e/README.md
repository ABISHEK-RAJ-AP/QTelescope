# E2E tests (Playwright)

Optional browser smoke for **Q-TeleScope** and Govern / Build. **Default CI uses API pytest only.**

## Prerequisites

```bash
cd tests/e2e
npm install
npx playwright install chromium
```

API and Govern dev servers must be reachable (or use `webServer` in config).

## Run Q-TeleScope smoke

```bash
# Terminal 1
cd /path/to/repo && E2E_CAPTCHA_BYPASS=1 PYTHONPATH=. uvicorn app.main:app --port 8000

# Terminal 2
cd frontend && npm run dev

# Terminal 3
cd tests/e2e
E2E_PLAYWRIGHT=1 E2E_CAPTCHA_BYPASS=1 E2E_API_URL=http://127.0.0.1:8000 E2E_TELESCOPE_URL=http://127.0.0.1:5173 npx playwright test --project=telescope
```

| Variable | Default |
| --- | --- |
| `E2E_TELESCOPE_URL` | `http://127.0.0.1:5173` |
| `E2E_CAPTCHA_BYPASS` | unset — login journeys **skipped** without `1` on API |
| `E2E_TELESCOPE_USER` / `E2E_TELESCOPE_PASSWORD` | `admin` / `quantum2026` (lab only) |

Login journeys type captcha code **`BYPASS`** when API has `E2E_CAPTCHA_BYPASS=1` and profile is not production.

Specs: `telescope-smoke.spec.ts`, `telescope-journeys.spec.ts` (E01–E06), `telescope-journeys-ops.spec.ts` (E07–E10), `telescope-journeys-record.spec.ts` (E11–E16), `telescope-journeys-admin.spec.ts` (E17–E24).

E21 needs `PERSIST_API_SESSIONS=true` and two concurrent logins. E17 collection can take up to ~2 minutes.

## Run Govern smoke

```bash
# Terminal 1
cd /path/to/repo && PYTHONPATH=. uvicorn app.main:app --port 8000

# Terminal 2
cd apps/govern && npm run dev

# Terminal 3
cd tests/e2e
E2E_PLAYWRIGHT=1 E2E_API_URL=http://127.0.0.1:8000 E2E_GOVERN_URL=http://127.0.0.1:5175 npx playwright test
```

Environment:

| Variable | Default |
| --- | --- |
| `E2E_PLAYWRIGHT` | unset → tests **skipped** |
| `E2E_API_URL` | `http://127.0.0.1:8000` |
| `E2E_GOVERN_URL` | `http://127.0.0.1:5175` |
