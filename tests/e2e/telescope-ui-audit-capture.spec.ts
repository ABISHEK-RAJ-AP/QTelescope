/**
 * Phase 1 UI audit screenshots → docs/quality/ui-audit/
 * API must run with E2E_CAPTCHA_BYPASS=1. Not part of default journey suite.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { apiLoginBypass } from './telescope-helpers';

const OUT = path.resolve(__dirname, '../../docs/quality/ui-audit');

const ROUTES: { path: string; file: string; heading?: RegExp; waitMs?: number }[] = [
  { path: '/app/platform/health', file: 'platform-health-desktop-light.png', heading: /platform health/i, waitMs: 8000 },
  { path: '/app/execution/queues', file: 'queue-monitoring-desktop-light.png', heading: /queue/i, waitMs: 12000 },
  { path: '/app/telemetry/cal-timeline', file: 'calibration-events-pagination-desktop-light.png', heading: /calibration/i, waitMs: 10000 },
  { path: '/app/alerts', file: 'alerts-desktop-light.png', heading: /alert/i, waitMs: 10000 },
  { path: '/app/backends/inventory', file: 'backend-inventory-desktop-light.png', heading: /backend library/i, waitMs: 15000 },
];

test.describe.configure({ mode: 'serial' });

test('capture priority audit routes', async ({ page, request }) => {
  test.setTimeout(180_000);
  const body = await apiLoginBypass(request, { username: 'superadmin', password: 'quantum2026' });
  expect(body.user?.token).toBeTruthy();
  await page.goto('/app/overview');
  await page.evaluate((user) => {
    localStorage.setItem('quantum_user', JSON.stringify(user));
  }, body.user);
  await page.reload();
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 60_000 });

  for (const r of ROUTES) {
    await page.goto(r.path);
    if (r.heading) {
      await expect(page.getByRole('heading', { name: r.heading }).first()).toBeVisible({ timeout: 90_000 });
    }
    if (r.waitMs) await page.waitForTimeout(r.waitMs);
    await page.screenshot({ path: path.join(OUT, r.file), fullPage: true });
  }

  await page.goto('/app/alerts');
  await page.waitForTimeout(3000);
  const samples = await page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        fontFamily: cs.fontFamily.split(',')[0],
      };
    };
    return {
      h1: pick('h1'),
      pageStack: pick('.page-stack'),
      th: pick('.custom-table th'),
      td: pick('.custom-table td'),
    };
  });
  // eslint-disable-next-line no-console
  console.log('TYPO_SAMPLES', JSON.stringify(samples));
});
