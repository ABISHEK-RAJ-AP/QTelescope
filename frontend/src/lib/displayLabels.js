/** Operator-facing labels — IDs belong in drawers/copy chips, not primary chrome. */

const PROVIDER_PREFIX = {
  ibm: 'IBM',
  ionq: 'IonQ',
  rigetti: 'Rigetti',
  cdac: 'C-DAC',
};

function titleCaseWord(w) {
  if (!w) return '';
  if (/^\d+q$/i.test(w)) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * @param {{ backend_id?: string, backend_name?: string, name?: string }} row
 */
function humanizeBackendId(id) {
  const parts = id.split('_').filter(Boolean);
  const provider = PROVIDER_PREFIX[parts[0]?.toLowerCase()] || titleCaseWord(parts[0]);
  const tail = parts.slice(1).map(titleCaseWord).join(' ');
  return [provider, tail].filter(Boolean).join(' ') || id;
}

export function formatBackendTitle(row = {}) {
  const id = String(row.backend_id || '').trim();
  const apiName = String(row.backend_name || row.name || '').trim();
  if (apiName && apiName !== id) {
    const apiNorm = apiName.replace(/[\s_-]+/g, '').toLowerCase();
    const idNorm = id.replace(/_/g, '').toLowerCase();
    if (!apiNorm.includes(idNorm) && idNorm !== apiNorm) return apiName;
    if (!apiName.includes('_')) return apiName;
  }
  if (!id) return apiName || 'Unknown backend';
  return humanizeBackendId(id);
}

/** Rule / alert_type → sentence label */
/** Registry provider_id → operator label */
export function formatProviderLabel(providerId, fallbackName) {
  const fromApi = String(fallbackName || '').trim();
  if (fromApi && !fromApi.includes('_')) return fromApi;
  const id = String(providerId || '').trim();
  if (!id) return fromApi || 'Provider not set';
  const map = {
    ibm_quantum: 'IBM Quantum',
    ibm: 'IBM Quantum',
    rigetti_quantum: 'Rigetti',
    rigetti: 'Rigetti',
    ionq_quantum: 'IonQ',
    ionq: 'IonQ',
    ionq_forte: 'IonQ',
    cdac_quantum: 'C-DAC',
    cdac: 'C-DAC',
    cdac_qsim_param: 'C-DAC',
  };
  if (map[id]) return map[id];
  const head = id.split('_')[0]?.toLowerCase();
  if (PROVIDER_PREFIX[head]) return PROVIDER_PREFIX[head];
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatModalityLabel(modality) {
  if (!modality) return 'Modality not set';
  const m = String(modality).toLowerCase();
  const labels = {
    superconducting: 'Superconducting',
    trapped_ion: 'Trapped ion',
    simulator: 'Simulator',
  };
  return labels[m] || modality.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatRuleLabel(alertType) {
  if (!alertType) return 'Alert';
  return String(alertType)
    .split('_')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : titleCaseWord(w)))
    .join(' ');
}

const OPERATIONAL_STATUS = {
  ONLINE: 'Reachable',
  OFFLINE: 'Offline',
  DEGRADED: 'Degraded',
  MAINTENANCE: 'Maintenance',
  UNKNOWN: 'Not reported',
};

const OPERATIONAL_STATUS_TITLE = {
  ONLINE: 'Registered in catalog; last poll did not report offline',
  OFFLINE: 'Catalog reports this backend offline',
  DEGRADED: 'Catalog reports reduced availability',
  MAINTENANCE: 'Scheduled or vendor maintenance window',
  UNKNOWN: 'No operational status in registry',
};

/** SCREAMING_SNAKE or snake_case API enums → operator phrase */
export function formatEnumLabel(value) {
  if (value == null || value === '') return '—';
  const raw = String(value).trim();
  if (!raw.includes('_') && raw === raw.toUpperCase() && raw.length <= 24) {
    return OPERATIONAL_STATUS[raw] || titleCaseWord(raw.toLowerCase());
  }
  return raw
    .split('_')
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : titleCaseWord(w)))
    .join(' ');
}

export function formatOperationalStatus(status) {
  const key = String(status || 'UNKNOWN').toUpperCase();
  return {
    key,
    label: OPERATIONAL_STATUS[key] || formatEnumLabel(key),
    title: OPERATIONAL_STATUS_TITLE[key] || 'Operational status from backend registry',
  };
}

const LINEAGE_FILTER_LABEL = {
  live: 'Live ingest',
  simulated: 'Demo catalog',
  mock_catalog: 'Demo catalog',
  stub: 'Catalog stub',
  unknown: 'Source pending',
  replay: 'Replay',
};

export function formatLineageFilterLabel(lineage) {
  const k = String(lineage || 'unknown').toLowerCase();
  return LINEAGE_FILTER_LABEL[k] || formatEnumLabel(k);
}
