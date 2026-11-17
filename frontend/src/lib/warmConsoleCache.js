import { fetchApiCached } from '../services/api.js';

/** Prefetch hot console reads after login so first navigation is instant. */
const WARM_ENDPOINTS = [
  ['/backends', 60_000],
  ['/backends/status-all', 45_000],
  ['/fleet/summary', 30_000],
  ['/alerts/summary', 25_000],
  ['/health/vector', 45_000],
  ['/queues', 30_000],
  ['/calibration', 45_000],
  ['/operations/centre', 25_000],
  ['/reports/batch', 45_000],
];

let warmedForToken = '';

export function warmConsoleCache({ force = false } = {}) {
  let token = '';
  try {
    const raw = localStorage.getItem('quantum_user');
    if (raw) token = JSON.parse(raw)?.token || '';
  } catch {
    token = '';
  }
  if (!token) return Promise.resolve();
  if (!force && warmedForToken === token) return Promise.resolve();
  warmedForToken = token;
  return Promise.allSettled(
    WARM_ENDPOINTS.map(([path, ttl]) => fetchApiCached(path, { ttlMs: ttl })),
  );
}

export function resetConsoleWarmCache() {
  warmedForToken = '';
}