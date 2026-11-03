import { test, expect } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const governBase = process.env.E2E_GOVERN_URL || 'http://127.0.0.1:5175';

async function withDevSession(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('qre_govern_dev', '1');
    localStorage.setItem('qre_role', 'Admin');
    localStorage.setItem('qre_user', 'Admin');
  });
  await page.route('**/api/v1/**', async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'x-user-role': 'Admin',
        'x-user-name': 'E2E',
        'x-qre-dev-ack': '1',
      },
    });
  });
}

test.describe('Govern SPA smoke', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_PLAYWRIGHT, 'Set E2E_PLAYWRIGHT=1 and run dev servers (see README.md)');
  });

  test('API reachable', async ({ request }) => {
    const r = await request.get(`${api}/`);
    expect(r.ok()).toBeTruthy();
  });

  test('overview loads with dev session headers', async ({ page }) => {
    await withDevSession(page);
    await page.goto(`${governBase}/govern/#/`);
    await expect(page.getByRole('heading', { name: /^overview$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No admission mix yet')).toBeVisible();
  });

  test('queue route renders approvals section', async ({ page }) => {
    await withDevSession(page);
    await page.goto(`${governBase}/govern/#/queue`);
    await expect(page.getByRole('heading', { name: /approval queue/i })).toBeVisible({ timeout: 15_000 });
  });

  test('missing review id is an error not a fake decision', async ({ page }) => {
    await withDevSession(page);
    await page.goto(`${governBase}/govern/#/queue/does-not-exist`);
    await expect(page.getByText(/not found|request failed/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /approve stage/i })).toHaveCount(0);
  });
});
