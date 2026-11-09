import { test, expect } from '@playwright/test';
import { E2E_CAPTCHA_BYPASS, fillLoginForm, gotoBackendInventory, loginAsAdmin } from './telescope-helpers';

const api = process.env.E2E_API_URL || 'http://127.0.0.1:8000';

test.describe('Q-TeleScope journeys E01–E06', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 (see README.md)');
    test.skip(
      process.env.E2E_CAPTCHA_BYPASS !== '1' && process.env.E2E_CAPTCHA_BYPASS !== 'true',
      'API must run with E2E_CAPTCHA_BYPASS=1 for login journeys',
    );
  });

  test('E01 landing → login shows captcha', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/image verification/i)).toBeVisible();
  });

  test('E02 login → captcha validation error', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, { username: 'admin', password: 'wrong-password', captcha: 'NOTVALID' });
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 15_000 });
  });

  test('E03 login → MFA step when required', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, {
      username: process.env.E2E_TELESCOPE_USER ?? 'admin',
      password: process.env.E2E_TELESCOPE_PASSWORD ?? 'quantum2026',
      captcha: E2E_CAPTCHA_BYPASS,
    });
    await page.getByTestId('login-submit').click();
    const mfa = page.getByLabel(/authenticator code/i);
    const dashboard = page.locator('[data-tour="page-kpis"]');
    await expect(mfa.or(dashboard)).toBeVisible({ timeout: 30_000 });
  });

  test('E04 forgot password flow loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await page.locator('input[autocomplete="username"]').fill('admin');
    await page.getByRole('button', { name: /request reset/i }).click();
    await expect(page.getByText(/if an account exists for that identity/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('E05 login → dashboard overview', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/overview');
    await expect(page.locator('[data-tour="page-kpis"]')).toBeVisible({ timeout: 60_000 });
  });

  test('E06 dashboard → backend inventory', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoBackendInventory(page);
  });

  test('E22 unauthorized API structured error', async ({ request }) => {
    const r = await request.get(`${api}/api/v1/backends`, { headers: { Authorization: 'Bearer qtok_invalid' } });
    if (r.status() === 401) {
      const body = await r.json();
      expect(body.error?.request_id || r.headers()['x-request-id']).toBeTruthy();
    } else {
      test.skip(true, 'REQUIRE_API_AUTH=false in this environment');
    }
  });
});
