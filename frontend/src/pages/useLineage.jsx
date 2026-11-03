import { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';

/** provider_id -> 'live' | 'simulated' | ... from platform-health collectors. null until loaded/failed. */
export function useProviderLineage() {
  const [map, setMap] = useState(null);
  useEffect(() => {
    fetchApi('/operations/platform-health')
      .then((r) => setMap(Object.fromEntries((r?.collectors?.providers || []).map((p) => [p.provider_id, p.lineage]))))
      .catch(() => setMap({}));
  }, []);
  return map;
}

/** Text + glyph so provenance is never colour-only. */
export function LineageBadge({ lineage }) {
  const l = lineage || 'unknown';
  const cls = l === 'live' ? 'badge-healthy' : l === 'simulated' ? 'badge-warning' : 'badge-info';
  const mark = l === 'live' ? '●' : l === 'simulated' ? '◐' : '○';
  return <span className={`badge ${cls}`} title={l === 'live' ? 'Live provider adapter' : l === 'simulated' ? 'Simulated telemetry' : 'Provenance unknown'}><span aria-hidden>{mark}</span> {l}</span>;
}
