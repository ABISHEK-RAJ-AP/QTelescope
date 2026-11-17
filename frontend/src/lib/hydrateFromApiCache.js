import { peekApiCache } from '../services/api.js';

/** True when each path has a non-expired stale entry (instant paint). */
export function hasWarmCache(paths) {
  return paths.every((p) => peekApiCache(p) !== undefined);
}

/** Build BackendInventory-shaped state from cached GET payloads (best-effort). */
export function hydrateBackendInventoryFromCache() {
  const backends = peekApiCache('/backends');
  if (!backends) return null;
  const hv = peekApiCache('/health/vector');
  const queues = peekApiCache('/queues');
  const alertSummary = peekApiCache('/alerts/summary');
  const statusAll = peekApiCache('/backends/status-all');
  const hvMap = Object.fromEntries((hv?.backends || []).map((b) => [b.backend_id, b]));
  const qMap = Object.fromEntries((queues || []).map((q) => [q.backend_id, q]));
  const stMap = Object.fromEntries((statusAll || []).map((s) => [s.backend_id, s]));
  return {
    backends,
    hvMap,
    qMap,
    alertN: alertSummary?.by_backend || {},
    stMap,
    alertsOk: !!alertSummary,
    alertFleetActive: alertSummary?.active ?? null,
    alertFleetCritical: alertSummary?.critical ?? null,
  };
}

export function hydrateDashboardSlice(keys) {
  const out = {};
  const map = {
    backends: '/backends',
    alertsSummary: '/alerts/summary',
    fleetSummary: '/fleet/summary',
    queues: '/queues',
    calibrations: '/calibration',
    coherence: '/health/coherence',
    platform: '/operations/platform-health',
    health: '/health/vector',
    centre: '/operations/centre',
    timeline: '/operations/timeline?limit=60',
  };
  keys.forEach((k) => {
    const path = map[k];
    if (path) {
      const v = peekApiCache(path);
      if (v !== undefined) out[k] = v;
    }
  });
  return out;
}