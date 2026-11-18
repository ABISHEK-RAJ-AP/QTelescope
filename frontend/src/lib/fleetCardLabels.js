/** When to show operator-set facility on inventory cards (not vendor product line). */

const VENDOR_FACILITY_ALIASES = new Set([
  'ibm quantum',
  'rigetti qcs',
  'ionq cloud',
  'c-dac param',
  'amazon braket',
]);

export function shouldShowFacilityTag({ facility, provider }) {
  const f = String(facility || '').trim();
  if (!f || f === '—') return false;
  const fl = f.toLowerCase();
  if (VENDOR_FACILITY_ALIASES.has(fl)) return false;
  const p = String(provider || '').trim().toLowerCase();
  if (p && (fl === p || fl.startsWith(`${p} `) || fl.startsWith(`${p}/`))) return false;
  return true;
}