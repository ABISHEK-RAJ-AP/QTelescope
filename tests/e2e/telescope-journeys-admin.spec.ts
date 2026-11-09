import { test, expect } from '@playwright/test';
import { apiLoginBypass, firstBackendId, getAuthToken, loginAsAdmin } from './telescope-helpers';

const api = () => process.env.E2E_API_URL || 'http://127.0.0.1:8000';

test.describe('Q-TeleScope journeys E17–E24', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 (see README.md)');
    test.skip(
      process.env.E2E_CAPTCHA_BYPASS !== '1' && process.env.E2E_CAPTCHA_BYPASS !== 'true',
      'API must run with E2E_CAPTCHA_BYPASS=1 for login journeys',
    );
  });

  test('E17 collector execution', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/admin/collectors');
    await expect(page.locator('[data-tour="page-admin-collectors"]')).toBeVisible({ timeout: 20_000 });
    const run = page.getByRole('button', { name: /run collection now/i });
    await expect(run).toBeEnabled();
    await run.click();
    await page.getByRole('alertdialog').getByRole('button', { name: /yes, run now/i }).click();
    await expect(page.locator('[data-tour="page-admin-collectors"]')).toContainText(/collection finished|collecting/i, {
      timeout: 120_000,
    });
  });

  test('E18 rule creation', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/admin/rules');
    await expect(page.locator('[data-tour="page-admin-rules"]')).toBeVisible({ timeout: 20_000 });
    const ruleId = `e2e_rule_${Date.now()}`;
    await page.getByRole('button', { name: /add rule/i }).click();
    await expect(page.getByRole('dialog', { name: /add alert rule/i })).toBeVisible();
    await page.getByPlaceholder(/rule_low_t1/i).fill(ruleId);
    await page.locator('.admin-rule-form input[type="number"]').fill('0.5');
    await page.getByRole('button', { name: /save rule/i }).click();
    await expect(page.locator('[data-tour="page-admin-rules"]')).toContainText(ruleId, { timeout: 20_000 });
  });

  test('E19 user and role management', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/admin/users');
    await expect(page.locator('[data-tour="page-admin-users"]')).toBeVisible({ timeout: 20_000 });
    const roleSelect = page.locator('.admin-users-role-select').first();
    await expect(roleSelect).toBeVisible();
    const options = await roleSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('E20 session cleared → sign-in gate', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/app/overview');
    await page.evaluate(() => localStorage.removeItem('quantum_user'));
    await page.reload();
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
  });

  test('E21 second session invalidated via API', async ({ page, request }) => {
    await loginAsAdmin(page);
    const token1 = await getAuthToken(page);
    test.skip(!token1, 'No bearer token in browser session');
    const second = await apiLoginBypass(request);
    const token2 = second.token;
    test.skip(!token2, 'No token from second login');
    const list = await request.get(`${api()}/api/v1/users/me/sessions`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    test.skip(!list.ok(), 'Session list unavailable (PERSIST_API_SESSIONS?)');
    const sessions = (await list.json()).sessions || [];
    const other = sessions.find((s: { current?: boolean; session_id: string }) => !s.current);
    test.skip(!other, 'Need two concurrent sessions for revocation test');
    const del = await request.delete(`${api()}/api/v1/users/me/sessions/${encodeURIComponent(other.session_id)}`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    expect(del.ok()).toBeTruthy();
    const me2 = await request.get(`${api()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(me2.status()).toBe(401);
  });

  test('E22 unauthorized API returns structured error', async ({ request }) => {
    const r = await request.get(`${api()}/api/v1/backends`, { headers: { Authorization: 'Bearer qtok_invalid' } });
    if (r.status() === 401) {
      const body = await r.json();
      expect(body.error?.request_id || r.headers()['x-request-id']).toBeTruthy();
    } else {
      test.skip(true, 'REQUIRE_API_AUTH=false in this environment');
    }
  });

  test('E23 browser refresh on deep route', async ({ page, request }) => {
    const body = await apiLoginBypass(request);
    const backendId = body.token ? await firstBackendId(request, body.token) : null;
    test.skip(!backendId, 'No backends for deep route');
    await loginAsAdmin(page);
    const path = `/app/backends/details/${encodeURIComponent(backendId!)}/calibration`;
    await page.goto(path);
    await expect(page.locator('[data-tour="page-backend-calibration"]')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.locator('[data-tour="page-backend-calibration"]')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`/app/backends/details/${backendId}`));
  });

  test('E24 responsive navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginAsAdmin(page);
    await page.goto('/app/overview');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBeFalsy();
  });
});
