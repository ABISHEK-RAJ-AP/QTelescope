import { formatBackendTitle, formatEnumLabel } from './displayLabels.js';
import {
  formatAlertMetricLabel,
  getAlertSignalSpec,
  isMetricThresholdAlert,
} from './alertSemantics.js';

export function backendNameForId(backendId, backends) {
  if (!backendId) return 'Fleet';
  const row = backends?.find((b) => b.backend_id === backendId);
  return formatBackendTitle(row || { backend_id: backendId });
}

export function kindLabel(kind) {
  if (!kind) return 'Event';
  return formatEnumLabel(kind.replace(/_/g, ' ')) || kind.replace(/_/g, ' ');
}

export function resourceHeadline(event) {
  const rid = String(event.resource_id || '').trim();
  if (event.resource_type === 'QUBIT' || /\bq\d+\b/i.test(rid)) {
    const m = rid.match(/(\d+)/);
    if (m) return `Qubit ${m[1]}`;
  }
  if (event.resource_type === 'BACKEND' && event.backend_id) {
    return backendNameForId(event.backend_id, []);
  }
  if (rid && !rid.includes('_')) return rid;
  return null;
}

/** Short operator-facing title (not the full alert sentence). */
export function timelineEventHeadline(event, backends) {
  if (event.kind === 'incident') return event.title || 'Incident';
  if (event.kind === 'collector_failure') return 'Collector run failed';
  if (event.alert_type) {
    const metric = formatAlertMetricLabel({
      alert_type: event.alert_type,
      resource_type: event.resource_type,
    });
    const res = resourceHeadline(event);
    if (res && metric && metric !== '—') return `${res} · ${metric}`;
    if (metric && metric !== '—') return metric;
  }
  const res = resourceHeadline(event);
  if (res) return res;
  const msg = String(event.message || event.title || '').trim();
  if (!msg) return kindLabel(event.kind);
  const first = msg.split(/[.!?]/)[0]?.trim();
  return (first && first.length <= 72) ? first : `${first.slice(0, 69)}…`;
}

export function timelineEventSummary(event) {
  const msg = String(event.message || '').trim();
  const headline = timelineEventHeadline(event);
  if (msg && msg !== headline && !msg.startsWith(headline)) return msg;
  if (event.summary) return String(event.summary);
  return '';
}

function fmtMetricValue(v, spec) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const d = spec?.decimals ?? (spec?.unit === '' && n < 1 ? 3 : 1);
  if (spec?.unit === '' && n <= 1 && spec.label?.toLowerCase().includes('readout')) {
    return `${(n * 100).toFixed(2)}%`;
  }
  const u = spec?.unit ? ` ${spec.unit}` : '';
  return `${n.toFixed(d)}${u}`;
}

/** Observed / threshold / delta for metric alerts; null when not applicable. */
export function timelineMetricTriplet(event) {
  if (event.kind !== 'alert') return null;
  const alert = {
    alert_type: event.alert_type,
    resource_type: event.resource_type,
    current_value: event.current_value,
    threshold_value: event.threshold_value,
  };
  if (!isMetricThresholdAlert(alert)) return null;
  const spec = getAlertSignalSpec(alert);
  const obs = Number(event.current_value);
  const thr = Number(event.threshold_value);
  if (!Number.isFinite(obs) || !Number.isFinite(thr)) return null;
  let delta = obs - thr;
  let deltaLabel = 'Vs threshold';
  if (spec?.unit === '' && obs <= 1 && thr <= 1) {
    delta = (obs - thr) * 100;
    deltaLabel = 'Above threshold';
  }
  return {
    observed: fmtMetricValue(obs, spec),
    threshold: fmtMetricValue(thr, spec),
    delta: `${delta >= 0 ? '+' : ''}${spec?.unit === '' && obs <= 1 ? delta.toFixed(2) : delta.toFixed(spec?.decimals ?? 1)}${spec?.unit === '' && obs <= 1 ? ' pp' : (spec?.unit ? ` ${spec.unit}` : '')}`,
    deltaLabel,
    spec,
  };
}