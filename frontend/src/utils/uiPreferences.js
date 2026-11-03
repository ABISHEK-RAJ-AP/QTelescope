/** UI prefs (localStorage MVP — no backend preference API). */

export const DENSITY_KEY = 'qtelescope_density';

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
  try {
    localStorage.setItem(DENSITY_KEY, mode);
  } catch {
    /* ignore */
  }
}
