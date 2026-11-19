import { fetchApiCached, peekApiCache } from '../services/api.js';
import { warmConsoleCache } from './warmConsoleCache.js';

/** Launch-film / E2E — prefetch journey APIs so first paint is data, not skeleton. */
export function filmWarmEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem('qt_film_warm') === '1') return true;
  } catch {
    /* ignore */
  }
  return new URLSearchParams(window.location.search).get('filmWarm') === '1';
}

export async function warmFilmJourney() {
  await warmConsoleCache({ force: true });
  let backends = peekApiCache('/backends');
  if (!backends) {
    backends = await fetchApiCached('/backends', { force: true, ttlMs: 120_000 });
  }
  const id = Array.isArray(backends) ? backends[0]?.backend_id : null;
  if (id) {
    await fetchApiCached(`/backends/${id}/topology`, { force: true, ttlMs: 120_000 });
  }
  await fetchApiCached('/queues', { force: true });
  await fetchApiCached('/alerts/summary', { force: true });
  await fetchApiCached('/alerts?limit=500&offset=0', { force: true, ttlMs: 60_000 });
  await fetchApiCached('/backends/status-all', { force: true });
  window.__QT_FILM_WARM__ = { done: true, ts: Date.now(), backendId: id || null };
  return window.__QT_FILM_WARM__;
}