import { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';
import { parseDate } from '../utils/time';

export const STATES = ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'];
export const STATE_LABEL = { GREEN: 'Green', YELLOW: 'Yellow', RED: 'Red', UNKNOWN: 'Unknown' };
// Glyphs so state is never color-only.
export const STATE_GLYPH = { GREEN: '●', YELLOW: '▲', RED: '◆', UNKNOWN: '○' };

// ponytail: fixed 15 min stale ceiling; collectors tick every ~1-5 min. Make per-provider if cadence differs.
export const STALE_MIN = 15;

export const PROVIDER_NAMES = {
  ibm_quantum: 'IBM Quantum',
  rigetti_quantum: 'Rigetti',
  ionq_quantum: 'IonQ',
  cdac_quantum: 'C-DAC',
};
export const KNOWN_PROVIDER_IDS = new Set(Object.keys(PROVIDER_NAMES));
export const MODALITY_NAMES = {
  superconducting: 'Superconducting',
  trapped_ion: 'Trapped ion',
  simulator: 'Simulator',
};
export const providerName = (id) => PROVIDER_NAMES[id] || id || 'Unknown';
export const modalityName = (m) => MODALITY_NAMES[m] || m || 'Unknown';

export function ageMinutes(ts) {
  const d = parseDate(ts);
  return d ? Math.max(0, (Date.now() - d.getTime()) / 60000) : null;
}

export function formatAge(min) {
  if (min == null) return 'Not available';
  if (min < 1) return '<1 min';
  if (min < 90) return `${Math.round(min)} min`;
  if (min < 48 * 60) return `${(min / 60).toFixed(1)} h`;
  return `${Math.round(min / 1440)} d`;
}

export const isStale = (min) => min == null || min > STALE_MIN;

export const median = (arr) => {
  const v = arr.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export const num = (v, d = 1) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

/** provider_id → { lineage, status, last_success_at } from platform-health collectors. */
export function useProviderLineage() {
  const [state, setState] = useState({ map: {}, error: false, loaded: false });
  useEffect(() => {
    let live = true;
    fetchApi('/operations/platform-health')
      .then((r) => {
        const map = {};
        (r?.collectors?.providers || []).forEach((p) => { map[p.provider_id] = p; });
        if (live) setState({ map, error: false, loaded: true });
      })
      .catch(() => live && setState({ map: {}, error: true, loaded: true }));
    return () => { live = false; };
  }, []);
  return state;
}

export function lineageOf(map, providerId) {
  return map?.[providerId]?.lineage || 'unknown';
}

/** Query string carrying backend + time window into other pages. */
export const scopeSearch = (backend, hours) => {
  const p = new URLSearchParams();
  if (backend) p.set('backend', backend);
  if (hours) p.set('hours', String(hours));
  const s = p.toString();
  return s ? `?${s}` : '';
};
