/** Pick a stable default backend_id from the live registry (mock catalog ids may be absent after hybrid discovery). */
export function resolveDefaultBackendId(backends, preferred = '') {
  const list = Array.isArray(backends) ? backends : [];
  if (!list.length) return preferred || '';
  const ids = new Set(list.map((b) => b.backend_id));
  const candidates = [preferred, 'ibm_brisbane', 'cdac_qsim_param', 'ionq_forte', 'rigetti_aspen_m3'].filter(Boolean);
  for (const id of candidates) {
    if (ids.has(id)) return id;
  }
  const hw = list.find((b) => b.backend_type !== 'simulator') || list[0];
  return hw?.backend_id || '';
}

export function backendExists(backends, backendId) {
  if (!backendId) return false;
  return (backends || []).some((b) => b.backend_id === backendId);
}