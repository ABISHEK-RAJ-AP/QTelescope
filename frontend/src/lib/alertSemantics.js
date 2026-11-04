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
