/** UI prefs (localStorage MVP — no backend preference API). */

export const DENSITY_KEY = 'qtelescope_density';
export const DENSITY_EVENT = 'qtelescope-density-changed';

export function readDensity() {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v === 'compact' || v === 'comfortable') return v;
  } catch {
    /* ignore */
  }
  return 'comfortable';
}

export function writeDensity(mode) {
  const next = mode === 'compact' ? 'compact' : 'comfortable';
  try {
    localStorage.setItem(DENSITY_KEY, next);
    window.dispatchEvent(new CustomEvent(DENSITY_EVENT, { detail: { mode: next } }));
  } catch {
    /* ignore */
  }
}
