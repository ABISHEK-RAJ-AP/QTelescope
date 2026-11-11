/** Non-metric alert types — do not show µs threshold breach UI. */
export const NON_METRIC_ALERT_TYPES = new Set([
  'BACKEND_OFFLINE',
  'BACKEND_UNAVAILABLE',
  'BACKEND_DEGRADED',
  'COLLECTOR_FAILURE',
  'COLLECTOR_STALE',
]);

/** True when observed/threshold µs comparison is meaningful. */
export function isMetricThresholdAlert(alert) {
  if (!alert || NON_METRIC_ALERT_TYPES.has(alert.alert_type)) return false;
  if (alert.resource_type === 'BACKEND' && !String(alert.resource_id || '').toLowerCase().includes('q')) {
    return false;
  }
  const thr = Number(alert.threshold_value);
  const obs = Number(alert.current_value);
  return Number.isFinite(thr) && Number.isFinite(obs) && thr > 0;
}

/** @deprecated alias */
export const isMetricAlert = isMetricThresholdAlert;

export function formatObservedVsThreshold(alert) {
  if (!alert) return 'Not available';
  if (!isMetricThresholdAlert(alert)) return 'Not applicable';
  const obs = Number(alert.current_value);
  const thr = Number(alert.threshold_value);
  return `${obs.toFixed(1)} µs vs ${thr.toFixed(1)}`;
}

/** Grouped row label (table / grid). */
export function formatObservedVsThresholdGroup(g) {
  const a = g?.items?.[0];
  if (!a) return 'Not available';
  if (!isMetricThresholdAlert(a)) return 'Not applicable';
  if (g.count > 1 && g.lo != null && g.hi != null) {
    return `${Number(g.lo).toFixed(1)}–${Number(g.hi).toFixed(1)} µs`;
  }
  return formatObservedVsThreshold(a);
}

/** Canonical alert count definitions — keep Dashboard, Operate, and sidebar aligned. */

export const ALERT_METRIC_LABELS = {
  criticalActive:
    'Alerts with status ACTIVE and severity CRITICAL in the platform database.',
  activeAll:
    'All alerts with status ACTIVE (any severity). Matches GET /alerts?status=ACTIVE count.',
  openIncidents:
    'Incidents in OPEN, ACKNOWLEDGED, or INVESTIGATING (Operations Centre aggregate).',
};

export function countCriticalActive(alerts) {
  return (alerts || []).filter((a) => a.severity === 'CRITICAL').length;
}

export function countActiveAlerts(alerts) {
  return (alerts || []).length;
}

/** Prefer server aggregate when present (same DB query as /operations/centre). */
export function resolveActiveAlertTotal(activeAlertsFromList, operationsActiveAlerts) {
  if (typeof operationsActiveAlerts === 'number' && !Number.isNaN(operationsActiveAlerts)) {
    return operationsActiveAlerts;
  }
  return countActiveAlerts(activeAlertsFromList);
}
