import { defineConfig } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const govern = process.env.E2E_GOVERN_URL || 'http://127.0.0.1:5175';
const telescope = process.env.E2E_TELESCOPE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'telescope',
      testMatch: /telescope-.*\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: telescope },
    },
    {
      name: 'govern',
      testMatch: /govern-.*\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: govern },
    },
  ],
  metadata: { e2eApiUrl: api },
});
