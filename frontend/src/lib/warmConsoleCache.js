import { fetchApiCached } from '../services/api.js';

/** Hot paths — prefetch right after login. */
const WARM_CRITICAL = [
  ['/backends', 60_000],
  ['/backends/status-all', 45_000],
  ['/fleet/summary', 30_000],
  ['/alerts/summary', 25_000],
];

/** Heavy / report payloads — deferred after first paint. */
const WARM_DEFERRED = [
  ['/health/vector', 45_000],
  ['/queues', 30_000],
  ['/calibration', 45_000],
  ['/operations/centre', 25_000],
  ['/reports/batch', 45_000],
];

let warmedForToken = '';
let deferredHandle = null;

function scheduleDeferredWarm() {
  if (deferredHandle != null) return;
  const run = () => {
    deferredHandle = null;
    Promise.allSettled(
      WARM_DEFERRED.map(([path, ttl]) => fetchApiCached(path, { ttlMs: ttl })),
    );
  };
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    deferredHandle = window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    deferredHandle = window.setTimeout(run, 1500);
  }
}

export function warmConsoleCache({ force = false, includeDeferred = true } = {}) {
  let token = '';
  try {
    const raw = localStorage.getItem('quantum_user');
    if (raw) token = JSON.parse(raw)?.token || '';
  } catch {
    token = '';
  }
  if (!token) return Promise.resolve();
  if (!force && warmedForToken === token) {
    if (includeDeferred) scheduleDeferredWarm();
    return Promise.resolve();
  }
  warmedForToken = token;
  return Promise.allSettled(
    WARM_CRITICAL.map(([path, ttl]) => fetchApiCached(path, { ttlMs: ttl })),
  ).then(() => {
    if (includeDeferred) scheduleDeferredWarm();
  });
}

export function resetConsoleWarmCache() {
  warmedForToken = '';
  if (typeof window !== 'undefined' && deferredHandle != null) {
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(deferredHandle);
    else clearTimeout(deferredHandle);
    deferredHandle = null;
  }
}