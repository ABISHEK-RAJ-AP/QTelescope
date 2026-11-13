import { parseDate } from '../utils/time';
import { buildTimelineInvestigationLocation } from '../lib/investigationLinks.js';

export const SEV_RANK = { CRITICAL: 0, WARNING: 1, INFO: 2 };
export const sevRank = (s) => SEV_RANK[s] ?? 3;
export const toMs = (t) => parseDate(t)?.getTime() ?? null;

/** Link to the investigation timeline; `at` focuses detection time. */
export function timelineTo({ backendId, alertId, at } = {}) {
  const loc = buildTimelineInvestigationLocation({ backendId, alertId });
  const p = new URLSearchParams(loc.search);
  if (at) p.set('at', at);
  const s = p.toString();
  return { pathname: loc.pathname, search: s ? `?${s}` : '' };
}

export const healthTo = (backendId) => ({
  pathname: '/app/resources/health',
  search: backendId ? `?backend=${encodeURIComponent(backendId)}` : '',
});

export function incidentRuleTypes(title) {
  const raw = String(title || '');
  const sep = raw.includes('—') ? '—' : (raw.includes(' - ') ? ' - ' : null);
  const rules = sep ? raw.split(sep).slice(1).join(sep) : '';
  return rules.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Combined alert+incident lists: hide an alert when an incident on that backend already names its rule. */
export function dropAlertsCoveredByIncidents(events) {
  const covered = new Map();
  events.forEach((e) => {
    if (String(e.kind || '').toLowerCase() !== 'incident') return;
    const backend = e.backend_id || e.backendId;
    if (!backend) return;
    const set = covered.get(backend) || new Set();
    incidentRuleTypes(e.title).forEach((t) => set.add(t));
    covered.set(backend, set);
  });
  return events.filter((e) => {
    if (String(e.kind || '').toLowerCase() !== 'alert') return true;
    const backend = e.backend_id || e.backendId;
    const type = e.alert_type || e.alertType;
    if (!backend || !type) return true;
    return !covered.get(backend)?.has(type);
  });
}

export function qubitOf(a) {
  const m = /_Q(\d+)$/.exec(a?.resource_id || '');
  return m ? `Q${m[1]}` : null;
}
