import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './telescope-helpers';

test.describe('Q-TeleScope journeys E07–E10', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 (see README.md)');
    test.skip(
      process.env.E2E_CAPTCHA_BYPASS !== '1' && process.env.E2E_CAPTCHA_BYPASS !== 'true',
      'API must run with E2E_CAPTCHA_BYPASS=1 for login journeys',
    );
  });

  test('E07 backend workspace → calibration tab', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/backends/inventory');
    await expect(page.locator('[data-tour="page-inventory"]')).toBeVisible({ timeout: 20_000 });
    const workspace = page.locator('button.bk-link').first();
    await expect(workspace).toBeVisible({ timeout: 15_000 });
    await workspace.click();
    await expect(page).toHaveURL(/\/app\/backends\/details\//, { timeout: 15_000 });
    await page.getByRole('tab', { name: /^Calibration$/i }).click();
    await expect(page.locator('[data-tour="page-backend-calibration"]')).toBeVisible({ timeout: 15_000 });
  });

  test('E08 telemetry filters change scoped backend', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/telemetry/trends');
    const scope = page.locator('[data-tour="page-telemetry-filters"] select[aria-label="Backend scope"]');
    await expect(scope).toBeVisible({ timeout: 20_000 });
    const before = await scope.inputValue();
    const options = await scope.locator('option').evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    test.skip(options.length < 2, 'Need at least two backends for filter test');
    const next = options.find((v) => v !== before) || options[0];
    await scope.selectOption(next);
    await expect(scope).toHaveValue(next);
  });

  test('E09 live telemetry SSE status', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/telemetry/live');
    await expect(page.locator('[data-tour="page-live-chart"]')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('live-sse-status')).toContainText(/live|offline/i, { timeout: 45_000 });
  });

  test('E10 alert acknowledgement flow', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/alerts');
    await expect(page.locator('[data-tour="page-alert-filters"]')).toBeVisible({ timeout: 20_000 });
    const ack = page.getByRole('button', { name: /^Ack$/ }).first();
    const hasAck = await ack.isVisible().catch(() => false);
    test.skip(!hasAck, 'No open alerts to acknowledge in this environment');
    await ack.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /acknowledge/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });
});
