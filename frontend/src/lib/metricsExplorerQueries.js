/** Saved Metrics Explorer queries (browser localStorage until server profiles in S5+). */

export const METRICS_EXPLORER_STORAGE_KEY = 'qts_metrics_explorer_queries_v1';

export const EXPLORER_METRICS = [
  { id: 'pending_jobs', label: 'Pending jobs', source: 'telemetry', field: 'pending_jobs' },
  { id: 'wait_time', label: 'Est. wait (s)', source: 'telemetry', field: 'estimated_wait_time' },
  { id: 'cal_age', label: 'Calibration age (h)', source: 'calibration', field: 'calibration_age' },
];

function readRaw() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(METRICS_EXPLORER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listSavedQueries() {
  return readRaw().filter((q) => q && q.id && q.name && q.metricId);
}

export function saveQuery(entry) {
  const next = {
    id: entry.id || `mq_${Date.now()}`,
    name: String(entry.name || 'Untitled').trim().slice(0, 80),
    metricId: entry.metricId,
    primaryBackend: entry.primaryBackend || '',
    compareBackend: entry.compareBackend || '',
    hours: Number(entry.hours) > 0 ? Number(entry.hours) : 24,
    savedAt: new Date().toISOString(),
  };
  const all = readRaw().filter((q) => q.id !== next.id);
  all.unshift(next);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(METRICS_EXPLORER_STORAGE_KEY, JSON.stringify(all.slice(0, 20)));
  }
  return next;
}

export function deleteSavedQuery(id) {
  const all = readRaw().filter((q) => q.id !== id);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(METRICS_EXPLORER_STORAGE_KEY, JSON.stringify(all));
  }
  return all;
}
