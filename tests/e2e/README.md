# E2E tests (Playwright)

Optional browser smoke for Govern / Build. **Default CI uses API smoke only:** `tests/test_govern_pilot_smoke.py`.

## Prerequisites

```bash
cd tests/e2e
npm install
npx playwright install chromium
```

API and Govern dev servers must be reachable (or use `webServer` in config).

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
