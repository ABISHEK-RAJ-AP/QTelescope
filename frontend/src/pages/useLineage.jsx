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

/** One status dot (from .badge) plus a word. Simulated catalog is not shown. */
export function LineageBadge({ lineage }) {
  const l = lineage || 'unknown';
  if (l === 'simulated' || l === 'mock_catalog') return null;
  const cls = l === 'live' ? 'badge-healthy' : 'badge-info';
  const label = l === 'live' ? 'Live' : 'Unknown';
  return <span className={`badge ${cls}`} title={l === 'live' ? 'Live provider adapter' : 'Provenance unknown'}>{label}</span>;
}
