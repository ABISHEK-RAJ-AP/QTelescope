/** Non-metric alert types — no numeric threshold comparison UI. */
export const NON_METRIC_ALERT_TYPES = new Set([
  'BACKEND_OFFLINE',
  'BACKEND_UNAVAILABLE',
  'BACKEND_DEGRADED',
  'COLLECTOR_FAILURE',
  'COLLECTOR_STALE',
]);

/** @typedef {{ unit: string, dir: 'below'|'above', label: string, decimals?: number }} AlertSignalSpec */

/** @type {Record<string, AlertSignalSpec>} */
const SIGNAL_BY_TYPE = {
  LOW_T1: { unit: 'µs', dir: 'below', label: 'T1 coherence' },
  LOW_T2: { unit: 'µs', dir: 'below', label: 'T2 coherence' },
  STALE_CALIBRATION: { unit: 'h', dir: 'above', label: 'Calibration age' },
  HIGH_QUEUE: { unit: 'jobs', dir: 'above', label: 'Pending jobs' },
  HIGH_READOUT: { unit: '', dir: 'above', label: 'Readout error', decimals: 3 },
};

/** @returns {AlertSignalSpec | null} */
export function getAlertSignalSpec(alert) {
  if (!alert) return null;
  const type = alert.alert_type;
  if (SIGNAL_BY_TYPE[type]) return SIGNAL_BY_TYPE[type];
  if (type === 'STALE_CALIBRATION' || alert.resource_type === 'CALIBRATION') {
    return SIGNAL_BY_TYPE.STALE_CALIBRATION;
  }
  if (type === 'HIGH_QUEUE' || alert.resource_type === 'QUEUE') {
    return SIGNAL_BY_TYPE.HIGH_QUEUE;
  }
  return null;
}

/** True when observed/threshold numeric comparison is meaningful for UI. */
export function isMetricThresholdAlert(alert) {
  if (!alert || NON_METRIC_ALERT_TYPES.has(alert.alert_type)) return false;
  const spec = getAlertSignalSpec(alert);
  if (spec) {
    const thr = Number(alert.threshold_value);
    const obs = Number(alert.current_value);
    return Number.isFinite(thr) && Number.isFinite(obs);
  }
  if (alert.resource_type === 'BACKEND' && !String(alert.resource_id || '').toLowerCase().includes('q')) {
    return false;
  }
  const thr = Number(alert.threshold_value);
  const obs = Number(alert.current_value);
  return Number.isFinite(thr) && Number.isFinite(obs) && thr > 0;
}

/** @deprecated alias */
export const isMetricAlert = isMetricThresholdAlert;

function fmtNum(v, decimals = 1) {
  return Number(v).toFixed(decimals);
}

function boundWord(spec) {
  return spec.dir === 'below' ? 'min' : 'max';
}

function formatValuePair(obs, thr, spec) {
  const d = spec.decimals ?? 1;
  const u = spec.unit ? ` ${spec.unit}` : '';
  const ow = fmtNum(obs, d);
  const tw = fmtNum(thr, d);
  const bound = boundWord(spec);
  return `${ow}${u} / ${bound} ${tw}${u}`;
}

/** Compact signal for tables (legacy alias shape preserved where possible). */
export function formatObservedVsThreshold(alert) {
  if (!alert) return 'Not available';
  const spec = getAlertSignalSpec(alert);
  if (spec) {
    const obs = Number(alert.current_value);
    const thr = Number(alert.threshold_value);
    if (!Number.isFinite(obs) || !Number.isFinite(thr)) return 'Not available';
    return formatValuePair(obs, thr, spec);
  }
  if (!isMetricThresholdAlert(alert)) return 'Not applicable';
  const obs = Number(alert.current_value);
  const thr = Number(alert.threshold_value);
  return `${obs.toFixed(1)} µs / min ${thr.toFixed(1)} µs`;
}

/** Grouped row label (table / grid). */
export function formatObservedVsThresholdGroup(g) {
  const a = g?.items?.[0];
  if (!a) return 'Not available';
  const spec = getAlertSignalSpec(a);
  if (!spec && !isMetricThresholdAlert(a)) return 'Not applicable';
  if (g.count > 1 && g.lo != null && g.hi != null) {
    const d = spec?.decimals ?? 1;
    const u = spec?.unit ? ` ${spec.unit}` : ' µs';
    if (!spec) {
      return `${Number(g.lo).toFixed(1)}–${Number(g.hi).toFixed(1)} µs`;
    }
    return `${fmtNum(g.lo, d)}–${fmtNum(g.hi, d)}${u}`;
  }
  return formatObservedVsThreshold(a);
}

/** Metric name for incident / detail tables. */
export function formatAlertMetricLabel(alert) {
  const spec = getAlertSignalSpec(alert);
  if (spec) return spec.label;
  if (NON_METRIC_ALERT_TYPES.has(alert?.alert_type)) return '—';
  return alert?.alert_type?.replace(/_/g, ' ') || '—';
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