/**
 * Operator-facing scalar display (DATA_REPRESENTATION_AUDIT policy).
 * ponytail: one formatter — do not use bare em dash for null in KPI/EDT defaults.
 */

const LABELS = {
  unavailable: 'Not available',
  awaiting: 'Awaiting data',
  unsupported: 'Not supported',
  na: 'N/A',
  failed: 'Unable to load',
};

/**
 * @param {unknown} value
 * @param {{
 *   decimals?: number | null,
 *   unit?: string,
 *   nullLabel?: string,
 *   state?: keyof typeof LABELS,
 *   zeroIsValid?: boolean,
 * }} [opts]
 */
export function formatMetricValue(value, opts = {}) {
  const state = opts.state;
  if (state && LABELS[state]) return LABELS[state];

  const nullLabel = opts.nullLabel ?? LABELS.unavailable;
  if (value === '' || value == null) return nullLabel;

  const n = Number(value);
  if (!Number.isFinite(n)) return nullLabel;
  if (n === 0 && opts.zeroIsValid === false) return nullLabel;

  const decimals = opts.decimals ?? (Number.isInteger(n) ? 0 : 1);
  const core = n.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
  const unit = opts.unit?.trim();
  return unit ? `${core} ${unit}` : core;
}

/** Default cell text for EnterpriseDataTable when column has no custom render. */
export function formatTableScalar(value) {
  if (value == null || value === '') return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return formatMetricValue(value);
  return String(value);
}
