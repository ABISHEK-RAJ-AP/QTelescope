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

export function qubitOf(a) {
  const m = /_Q(\d+)$/.exec(a?.resource_id || '');
  return m ? `Q${m[1]}` : null;
}
