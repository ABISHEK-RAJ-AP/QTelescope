/** Format structured anomaly flags from the EWMA API (never stringify raw objects). */

export function describeAnomalyFlag(flag) {
  if (flag == null) return null;
  if (typeof flag === 'string') return flag.trim() || null;
  if (typeof flag !== 'object') return String(flag);

  const parts = [];
  if (flag.severity) parts.push(flag.severity);
  if (flag.reason) parts.push(String(flag.reason).replace(/_/g, ' '));
  if (flag.z_score != null && Number.isFinite(Number(flag.z_score))) {
    parts.push(`z ${Number(flag.z_score)}`);
  }
  if (flag.value != null && Number.isFinite(Number(flag.value))) {
    parts.push(`value ${Number(flag.value)}`);
  }
  return parts.length ? parts.join(' · ') : 'Anomaly flag';
}

export function formatAnomalyFlags(flags) {
  if (!Array.isArray(flags)) return [];
  return flags.map(describeAnomalyFlag).filter(Boolean);
}