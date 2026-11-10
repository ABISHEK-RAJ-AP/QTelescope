# UI audit screenshots

## Capture (authenticated)

1. API on `:8000` with `E2E_CAPTCHA_BYPASS=1` (see `scripts/start-e2e-api.sh`).
2. Frontend dev on `:5173`.
3. Run:

```bash
cd tests/e2e
E2E_CAPTCHA_BYPASS=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
  npx playwright test --project=audit-capture
```

Outputs land in this directory. Index: [EVIDENCE_INDEX.md](./EVIDENCE_INDEX.md).

## Status (2026-11-10)

- **9** desktop light PNGs captured (see index).
- Typography samples logged in Playwright stdout (`TYPO_SAMPLES`) and recorded in EVIDENCE_INDEX.
