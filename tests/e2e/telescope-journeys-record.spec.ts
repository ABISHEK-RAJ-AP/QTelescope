import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './telescope-helpers';

test.describe('Q-TeleScope journeys E11–E16', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 (see README.md)');
    test.skip(
      process.env.E2E_CAPTCHA_BYPASS !== '1' && process.env.E2E_CAPTCHA_BYPASS !== 'true',
      'API must run with E2E_CAPTCHA_BYPASS=1 for login journeys',
    );
  });

  test('E11 incident acknowledgement (assignment)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/alerts/incidents');
    await expect(page.locator('[data-tour="page-incidents"]')).toBeVisible({ timeout: 20_000 });
    const ack = page.getByRole('button', { name: /^Ack$/ }).first();
    test.skip(!(await ack.isVisible().catch(() => false)), 'No open incidents to acknowledge');
    await ack.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Acknowledge$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
  });

  test('E12 incident resolution', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/alerts/incidents');
    await expect(page.locator('[data-tour="page-incidents"]')).toBeVisible({ timeout: 20_000 });
    let resolve = page.getByRole('button', { name: /^Resolve$/ }).first();
    if (!(await resolve.isVisible().catch(() => false))) {
      const ack = page.getByRole('button', { name: /^Ack$/ }).first();
      test.skip(!(await ack.isVisible().catch(() => false)), 'No incidents for resolution flow');
      await ack.click();
      await page.getByRole('alertdialog').getByRole('button', { name: /^Acknowledge$/i }).click();
      await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: 20_000 });
      resolve = page.getByRole('button', { name: /^Resolve$/ }).first();
    }
    await resolve.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Resolve$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
  });

  test('E13 jobs → job detail drawer', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/execution/jobs');
    await expect(page.locator('[data-tour="page-jobs"]')).toBeVisible({ timeout: 20_000 });
    const jobLink = page.locator('button.jm-link, .jm-table button.jm-link').first();
    await expect(jobLink).toBeVisible({ timeout: 15_000 });
    await jobLink.click();
    await expect(page.locator('[data-tour="page-job-detail"]')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Lifecycle')).toBeVisible();
  });

  test('E14 queue backend filter', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/execution/queues');
    await expect(page.locator('[data-tour="page-queues"]')).toBeVisible({ timeout: 20_000 });
    const filter = page.getByLabel('Filter queues by backend');
    await expect(filter).toBeVisible();
    const options = await filter.locator('option').evaluateAll((els) =>
      els.map((o) => (o as HTMLOptionElement).value).filter((v) => v && v !== 'ALL'),
    );
    test.skip(!options.length, 'No queue rows to filter');
    await filter.selectOption(options[0]);
    await expect(filter).toHaveValue(options[0]);
    await expect(page.locator('.qm-table tbody tr, .dvt-grid article').first()).toBeVisible();
  });

  test('E15 report export', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/reports');
    await expect(page.locator('[data-tour="page-reports-export"]')).toBeVisible({ timeout: 20_000 });
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const disabled = await exportBtn.isDisabled();
    test.skip(disabled, 'Report export disabled (no rows)');
    await exportBtn.click();
    await expect(page.locator('.rp-status')).toContainText(/exported|done|rows/i, { timeout: 20_000 });
  });

  test('E16 evidence manifest / verification', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/reports');
    await expect(page.locator('[data-tour="page-evidence"]')).toBeVisible({ timeout: 20_000 });
    const prov = page.getByRole('button', { name: /^Provenance$/ }).first();
    const hasSnap = await prov.isVisible().catch(() => false);
    if (hasSnap) {
      await prov.click();
      await expect(page.getByRole('dialog')).toContainText(/SHA-256|manifest/i);
      return;
    }
    const gen = page.getByRole('button', { name: /generate snapshot/i });
    test.skip(!(await gen.isEnabled().catch(() => false)), 'Evidence snapshots unavailable');
    await gen.click();
    await expect(page.getByRole('button', { name: /^Provenance$/ }).first()).toBeVisible({ timeout: 60_000 });
  });
});
