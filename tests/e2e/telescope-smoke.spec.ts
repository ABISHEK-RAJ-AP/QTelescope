import { test, expect } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://127.0.0.1:8000';

test.describe('Q-TeleScope smoke', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 and run API + frontend (see README.md)');
  });

  test('E01 login page loads captcha challenge', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/captcha|verification/i).or(page.locator('img[alt*="captcha" i], img[alt*="verification" i]'))).toBeVisible();
  });

  test('E05 health endpoints reachable', async ({ request }) => {
    const hz = await request.get(`${api}/healthz`);
    expect(hz.ok()).toBeTruthy();
    const rz = await request.get(`${api}/readyz`);
    expect([200, 503]).toContain(rz.status());
  });

  test('E22 unauthorized API returns structured error', async ({ request }) => {
    const r = await request.get(`${api}/api/v1/backends`, { headers: { Authorization: 'Bearer qtok_invalid' } });
    if (r.status() === 401) {
      const body = await r.json();
      expect(body.error?.request_id || r.headers()['x-request-id']).toBeTruthy();
    } else {
      test.skip(true, 'REQUIRE_API_AUTH=false in this environment');
    }
  });
});
