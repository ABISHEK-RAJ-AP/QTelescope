import { expect, type Page } from '@playwright/test';

export const E2E_CAPTCHA_BYPASS = 'BYPASS';

export async function loginAsAdmin(page: Page, opts?: { username?: string; password?: string }) {
  const username = opts?.username ?? process.env.E2E_TELESCOPE_USER ?? 'admin';
  const password = opts?.password ?? process.env.E2E_TELESCOPE_PASSWORD ?? 'quantum2026';

  await page.goto('/login');
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/image verification|characters/i).fill(E2E_CAPTCHA_BYPASS);
  await page.getByTestId('login-submit').click();

  const mfa = page.getByLabel(/authenticator code/i);
  if (await mfa.isVisible().catch(() => false)) {
    testSkipMfa(page);
    return;
  }

  await expect(
    page
      .locator('[data-tour="page-kpis"]')
      .or(page.locator('[data-tour="page-inventory"]'))
      .or(page.getByRole('main')),
  ).toBeVisible({ timeout: 30_000 });
}

function testSkipMfa(page: Page) {
  throw new Error(
    `MFA required for ${page.url()} — disable MFA for E2E admin or set E2E_TELESCOPE_USER to a non-MFA account.`,
  );
}
