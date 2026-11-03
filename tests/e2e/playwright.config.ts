import { defineConfig } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const govern = process.env.E2E_GOVERN_URL || 'http://127.0.0.1:5175';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: govern,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  metadata: { e2eApiUrl: api },
});
