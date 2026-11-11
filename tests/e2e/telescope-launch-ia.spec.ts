import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './telescope-helpers';

test.describe('Launch IA — routes & deep links', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 (see README.md)');
    test.skip(
      process.env.E2E_CAPTCHA_BYPASS !== '1' && process.env.E2E_CAPTCHA_BYPASS !== 'true',
      'API must run with E2E_CAPTCHA_BYPASS=1 for login journeys',
    );
  });

  test('legacy backend path canonicalizes to inventory', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/backends/qubits');
    await expect(page).toHaveURL(/\/app\/backends\/inventory/, { timeout: 15_000 });
  });

  test('overview shows attention + KPI hero', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/overview');
    await expect(page.locator('[data-tour="page-kpis"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-tour="page-attention"]')).toBeVisible();
  });

  test('critical alerts query applies severity filter', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/alerts?severity=CRITICAL&status=ACTIVE');
    await expect(page.getByLabel('Filter by severity')).toHaveValue('CRITICAL', { timeout: 60_000 });
    await expect(page.getByLabel('Filter by status')).toHaveValue('ACTIVE');
  });
});

test.describe('Launch IA — accessibility smoke', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 (see README.md)');
    test.skip(
      process.env.E2E_CAPTCHA_BYPASS !== '1' && process.env.E2E_CAPTCHA_BYPASS !== 'true',
      'API must run with E2E_CAPTCHA_BYPASS=1 for login journeys',
    );
  });

  test('console routes expose main landmark and one h1', async ({ page }) => {
    await loginAsAdmin(page);
    for (const path of ['/app/overview', '/app/backends/inventory', '/app/alerts']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });
});
