import { defineConfig } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const govern = process.env.E2E_GOVERN_URL || 'http://127.0.0.1:5175';
const telescope = process.env.E2E_TELESCOPE_URL || 'http://127.0.0.1:5173';

const chromiumExecutable = (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '').trim();
const chromiumLaunch = chromiumExecutable ? { executablePath: chromiumExecutable } : undefined;

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  retries: 0,
  workers: Number(process.env.PW_WORKERS || 1),
  use: {
    trace: 'on-first-retry',
    ...(chromiumLaunch ? { launchOptions: chromiumLaunch } : {}),
  },
  projects: [
    {
      name: 'telescope',
      testMatch: /telescope-(?!ui-audit-capture).*\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: telescope },
    },
    {
      name: 'govern',
      testMatch: /govern-.*\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: govern },
    },
    {
      name: 'audit-capture',
      testMatch: /telescope-ui-audit-capture\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: telescope },
    },
    {
      name: 'launch-film',
      testMatch: /launch-film-capture\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: telescope, viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'launch-film-v2',
      testMatch: /launch-film-v2-capture\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: telescope, viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'launch-film-v2-scroll',
      testMatch: /launch-film-v2-scroll\.spec\.ts/,
      timeout: 900_000,
      use: { browserName: 'chromium', baseURL: telescope, viewport: { width: 1920, height: 1080 } },
    },
  ],
  metadata: { e2eApiUrl: api },
});
