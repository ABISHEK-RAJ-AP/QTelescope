import { parseDate } from '../utils/time';

export const STALE_HOURS = 6;

export const METRICS = {
  t1: { label: 'T1', unit: 'µs', higherIsBetter: true },
  t2: { label: 'T2', unit: 'µs', higherIsBetter: true },
  readout_error: { label: 'Readout error', unit: '', higherIsBetter: false },
};
export const METRIC_KEYS = Object.keys(METRICS);
export const normMetric = (m) => {
  const k = String(m || '').toLowerCase();
  return METRICS[k] ? k : 't1';
};

export const tsMs = (t) => parseDate(t)?.getTime() ?? null;

/** Unit-aware; trapped-ion T1 is millions of µs. Missing is "—", never 0. */
export function fmtMetric(v, metric = 't1') {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  if (metric === 'readout_error') return n.toFixed(4);
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} s`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ms`;
  return `${n.toFixed(1)} µs`;
}

export const fmtNum = (v, d = 2) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

/** Age in hours of newest timestamp, or null. */
export function ageHours(ts) {
  const ms = tsMs(ts);
  return ms == null ? null : (Date.now() - ms) / 3.6e6;
}
export const isStale = (ts) => {
  const a = ageHours(ts);
  return a != null && a > STALE_HOURS;
};

export const modalityOf = (backends, id) => backends.find((b) => b.backend_id === id)?.qpu_modality || '';

export const healthLink = (b, q) => `/app/resources/health?backend=${encodeURIComponent(b)}&qubit=${q}`;
export const timelineLink = (b) => `/app/investigate/timeline?backend=${encodeURIComponent(b)}`;
