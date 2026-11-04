import { toMs } from '../pages/opsHelpers.js';

export function parseIncidentTitle(title) {
  const t = String(title || '');
  const sep = t.includes(' — ') ? ' — ' : (t.includes(' - ') ? ' - ' : null);
  if (!sep) return { backendLabel: t, rule: '' };
  const idx = t.indexOf(sep);
  return { backendLabel: t.slice(0, idx), rule: t.slice(idx + sep.length) };
}

export function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** Build investigation timeline from incident record + comments. */
export function buildIncidentTimeline(inc) {
  if (!inc) return [];
  const events = [];
  const push = (at, kind, title, detail) => {
    const t = toMs(at);
    if (t == null) return;
    events.push({ t, kind, title, detail });
  };
  push(inc.first_detected_at, 'detect', 'First detection', inc.summary || 'Alert rule threshold breached.');
  if (toMs(inc.last_detected_at) !== toMs(inc.first_detected_at)) {
    push(inc.last_detected_at, 'detect', 'Latest detection', `${inc.alert_count || 0} linked alert(s) in correlation.`);
  }
  if (inc.acknowledged_by) {
    push(inc.last_detected_at, 'ack', 'Acknowledged', `By ${inc.acknowledged_by}`);
  }
  if (inc.status === 'INVESTIGATING') {
    push(inc.last_detected_at, 'investigate', 'Investigation started', 'Status set to INVESTIGATING.');
  }
  (inc.comments || []).forEach((c) => {
    push(c.created_at || c.at, 'comment', `Comment · ${c.author || 'operator'}`, c.text);
  });
  if (inc.resolved_at) {
    push(inc.resolved_at, 'resolve', 'Resolved', inc.resolution_notes || 'Incident closed.');
  } else if (inc.status === 'RESOLVED') {
    push(inc.last_detected_at, 'resolve', 'Resolved', inc.resolution_notes || 'Incident closed.');
  }
  return events.sort((a, b) => a.t - b.t);
}
