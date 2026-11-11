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
export function formatBackendTitle(row = {}) {
  const id = String(row.backend_id || '').trim();
  const apiName = String(row.backend_name || row.name || '').trim();
  if (apiName && apiName !== id && !apiName.includes(id)) return apiName;
  if (!id) return apiName || 'Unknown backend';
  const parts = id.split('_').filter(Boolean);
  const provider = PROVIDER_PREFIX[parts[0]?.toLowerCase()] || titleCaseWord(parts[0]);
  const tail = parts.slice(1).map(titleCaseWord).join(' ');
  return [provider, tail].filter(Boolean).join(' ') || id;
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
