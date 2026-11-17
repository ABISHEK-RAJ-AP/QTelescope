/** E2E / launch-film gate — when DOM is safe to capture (no skeletons, charts sized). */

const SKELETON_SEL = [
  '.boneyard-skeleton-page',
  '.boneyard-skeleton--dashboard',
  '.boneyard-skeleton--table',
  '.boneyard-skeleton--alerts',
  '.boneyard-skeleton--ops',
  '.boneyard-skeleton--timeline',
  '.boneyard-skeleton--grid',
  '.boneyard-skeleton--settings',
  '.boneyard-skeleton--list',
  '.boneyard-skeleton--backend',
  '.boneyard-skeleton--inline',
].join(', ');

function visible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
}

export function probeQtFilmReady() {
  const path = typeof window !== 'undefined' ? window.location?.pathname || '' : '';
  const reasons = [];

  if (document.body?.dataset?.qtReady === 'true' && window.__QT_READY__?.path === path) {
    return { ready: true, path, reasons: [] };
  }

  const checkingSession = [...document.querySelectorAll('[role="status"]')].some(
    (n) => visible(n) && /checking session/i.test(n.textContent || ''),
  );
  if (checkingSession) reasons.push('session-check');

  const shell = document.querySelector('.app-shell');
  const isApp = path.startsWith('/app');
  if (isApp && !shell) reasons.push('no-app-shell');

  [...document.querySelectorAll(SKELETON_SEL)].forEach((n) => {
    if (visible(n)) reasons.push(`skeleton:${n.className.split(/\s+/)[0]}`);
  });

  [...document.querySelectorAll('[role="status"][aria-label="Loading"], [aria-busy="true"][aria-label="Loading chart"]')].forEach((n) => {
    if (visible(n)) reasons.push('status-loading');
  });

  document.querySelectorAll('[data-qt-page-pending="true"]').forEach(() => reasons.push('page-pending'));
  document.querySelectorAll('[data-qt-charts-pending="true"]').forEach(() => reasons.push('charts-pending'));
  document.querySelectorAll('[data-qt-echart-pending="true"]').forEach((n) => {
    if (visible(n)) reasons.push('echart-pending');
  });

  const main = document.querySelector('.main-content') || document.querySelector('.landing-main') || document.body;
  if (main) {
    main.querySelectorAll('canvas').forEach((c) => {
      if (visible(c) && (c.width < 8 || c.height < 8)) reasons.push('chart-unsized');
    });
    const chartRoutes = /^\/app\/(overview|telemetry\/|alerts)/.test(path);
    if (chartRoutes) {
      const visibleShells = [...main.querySelectorAll('.qt-echart-shell')].filter(visible);
      if (visibleShells.length && visibleShells.some((s) => s.dataset.qtEchartPending === 'true')) {
        reasons.push('echarts-route-incomplete');
      }
    }
  }

  if (document.fonts?.status && document.fonts.status !== 'loaded') {
    reasons.push('fonts-pending');
  }

  const unique = [...new Set(reasons)];
  return { ready: unique.length === 0 && (!isApp || !!shell), path, reasons: unique };
}

export function setQtFilmReady(detail) {
  window.__QT_READY__ = { ...detail, ts: Date.now() };
  delete window.__QT_ERROR__;
  document.body.dataset.qtReady = 'true';
}

export function setQtFilmError(detail) {
  window.__QT_ERROR__ = { ...detail, ts: Date.now() };
  delete window.__QT_READY__;
  document.body.dataset.qtReady = 'error';
}

export function clearQtFilmReady() {
  delete window.__QT_READY__;
  delete window.__QT_ERROR__;
  delete document.body.dataset.qtReady;
}