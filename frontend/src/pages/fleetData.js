import { fetchApi } from '../services/api';

/** /alerts defaults to limit=100 — that truncation is why the sidebar (100) and
 *  server aggregate (106) disagreed. 500 is the API max. */
export const ALERT_LIST_LIMIT = 500;
/** @param {number} [limit] default 500 — use ~200 on operator console for faster loads */
export const fetchActiveAlerts = (limit = ALERT_LIST_LIMIT) =>
  fetchApi(`/alerts?status=ACTIVE&limit=${Math.min(limit, ALERT_LIST_LIMIT)}`);

export const STALE_MIN = 30;

export const ageMinutes = (iso) => {
  if (!iso) return null;
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : null;
};

export const fmtAge = (m) => {
  if (m == null) return 'unknown';
  if (m < 1) return '<1 min ago';
  if (m < 90) return `${Math.round(m)} min ago`;
  if (m < 2880) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

/** provider_id -> 'live' | 'simulated' | ... from collectors.providers[].lineage */
export const lineageByProvider = (providers = []) =>
  Object.fromEntries(providers.map((p) => [p.provider_id, p.lineage || 'unknown']));

export const SEV_ORDER = { CRITICAL: 0, WARNING: 1 };
export const sevRank = (s) => SEV_ORDER[s] ?? 2;
export const sevBadge = (s) =>
  (s === 'CRITICAL' ? 'badge-critical' : s === 'WARNING' ? 'badge-warning' : 'badge-info');

/** Group alerts by backend + severity + type. */
export function groupAlerts(alerts) {
  const m = new Map();
  alerts.forEach((a) => {
    const k = `${a.backend_id}|${a.severity}|${a.alert_type}`;
    const g = m.get(k) || {
      key: k, backend_id: a.backend_id, severity: a.severity, alert_type: a.alert_type,
      count: 0, latest: a.detected_at, ids: [], unacked: 0, sample: a.message,
    };
    g.count += 1;
    g.ids.push(a.alert_id);
    if (!a.acknowledged_by) g.unacked += 1;
    if (a.detected_at > g.latest) g.latest = a.detected_at;
    m.set(k, g);
  });
  return [...m.values()].sort(
    (x, y) => sevRank(x.severity) - sevRank(y.severity) || y.count - x.count,
  );
}

/** Collapse bursts of alert events per backend+severity; keep others as-is. */
export function groupTimeline(events = []) {
  const out = [];
  const idx = new Map();
  events.forEach((e) => {
    if (e.kind !== 'alert') { out.push({ ...e, n: 1 }); return; }
    const k = `${e.backend_id}|${e.severity}`;
    const hit = idx.get(k);
    if (hit) { hit.n += 1; return; }
    const row = { ...e, n: 1, id: e.id };
    idx.set(k, row);
    out.push(row);
  });
  return out.map((r) => (r.n > 1
    ? { ...r, title: `${r.n} ${r.severity} alerts on ${r.backend_id} (latest: ${r.title})` }
    : r));
}
