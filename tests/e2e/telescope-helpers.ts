import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const E2E_CAPTCHA_BYPASS = 'BYPASS';

const apiBase = () => process.env.E2E_API_URL || 'http://127.0.0.1:8000';

export async function fillLoginForm(
  page: Page,
  opts: { username: string; password: string; captcha: string },
) {
  await page.locator('input[autocomplete="username"]').fill(opts.username);
  await page.locator('input[autocomplete="current-password"]').fill(opts.password);
  await page.getByLabel(/characters from the image/i).fill(opts.captcha);
}

export async function gotoBackendInventory(page: Page) {
  await page.goto('/app/backends/inventory');
  await expect(page.getByRole('heading', { name: /backend library/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status', { name: 'Loading' })).toBeHidden({ timeout: 90_000 });
  await expect(page.locator('[data-tour="page-inventory"]')).toBeVisible({ timeout: 90_000 });
}

export async function apiLoginBypass(
  request: APIRequestContext,
  opts?: { username?: string; password?: string },
) {
  const username = opts?.username ?? process.env.E2E_TELESCOPE_USER ?? 'admin';
  const password = opts?.password ?? process.env.E2E_TELESCOPE_PASSWORD ?? 'quantum2026';
  const cap = await request.get(`${apiBase()}/api/v1/auth/captcha`);
  const captcha_id = (await cap.json()).captcha_id;
  const res = await request.post(`${apiBase()}/api/v1/auth/login`, {
    data: { username, password, captcha_id, captcha_code: E2E_CAPTCHA_BYPASS },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  if (body.status === 'MFA_REQUIRED') {
    throw new Error('MFA required for API login helper — use non-MFA account.');
  }
  return body as { token?: string; user?: Record<string, unknown> };
}

export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('quantum_user');
      return raw ? JSON.parse(raw).token : null;
    } catch {
      return null;
    }
  });
}

export async function firstBackendId(request: APIRequestContext, token: string): Promise<string | null> {
  const r = await request.get(`${apiBase()}/api/v1/backends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status() === 401) return null;
  const rows = await r.json();
  const id = rows?.[0]?.backend_id;
  return id ? String(id) : null;
}

export async function loginAsAdmin(page: Page, opts?: { username?: string; password?: string }) {
  const username = opts?.username ?? process.env.E2E_TELESCOPE_USER ?? 'admin';
  const password = opts?.password ?? process.env.E2E_TELESCOPE_PASSWORD ?? 'quantum2026';

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  // AuthShell Field labels are visual-only (no htmlFor) — use stable input hooks.
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByLabel(/characters from the image/i).fill(E2E_CAPTCHA_BYPASS);
  await page.getByTestId('login-submit').click();

  const mfa = page.getByLabel(/authenticator code/i);
  if (await mfa.isVisible().catch(() => false)) {
    testSkipMfa(page);
    return;
  }

  await expect(page).toHaveURL(/\/app\//, { timeout: 45_000 });
  await expect(
    page
      .locator('[data-tour="page-kpis"]')
      .or(page.getByRole('heading', { name: /backend library|fleet overview|operator console/i })),
  ).toBeVisible({ timeout: 45_000 });
}

function testSkipMfa(page: Page) {
  throw new Error(
    `MFA required for ${page.url()} — disable MFA for E2E admin or set E2E_TELESCOPE_USER to a non-MFA account.`,
  );
}
