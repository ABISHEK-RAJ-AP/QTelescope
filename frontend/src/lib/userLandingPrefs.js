/** Cache account workspace prefs for shell routing (landing page, alerts tab). */

const LANDING_KEY = 'qts_landing_page';
const ALERTS_VIEW_KEY = 'qts_default_alerts_view';

export function cacheWorkspacePrefs(prefs = {}) {
  try {
    if (prefs.landing_page) localStorage.setItem(LANDING_KEY, prefs.landing_page);
    if (prefs.default_alerts_view) localStorage.setItem(ALERTS_VIEW_KEY, prefs.default_alerts_view);
  } catch {
    /* ignore */
  }
}

export function readCachedLandingPath(fallback = '/app/overview') {
  try {
    const v = localStorage.getItem(LANDING_KEY);
    if (v === 'alerts') return '/app/alerts';
    if (v === 'operations') return '/app/operate';
    if (v === 'overview') return '/app/overview';
  } catch {
    /* ignore */
  }
  return fallback;
}

export function readCachedAlertsView() {
  try {
    const v = localStorage.getItem(ALERTS_VIEW_KEY);
    if (v === 'incidents' || v === 'alerts') return v;
  } catch {
    /* ignore */
  }
  return 'alerts';
}