import { mergeScopeSearch } from './appScopeQuery.js';

export const BACKEND_WORKSPACE_TABS = [
  'overview',
  'qubits',
  'calibration',
  'connectivity',
  'execution',
];

export function buildBackendDetailsPath(backendId, tab = 'overview') {
  const id = encodeURIComponent(backendId || '');
  const base = `/app/backends/details/${id}`;
  const withTab = !tab || tab === 'overview' || !BACKEND_WORKSPACE_TABS.includes(tab) ? base : `${base}/${tab}`;
  return withTab;
}

/** Path + search so shell scope matches the workspace backend (avoids stale Details tab id). */
export function buildBackendDetailsLocation(backendId, tab = 'overview') {
  const pathname = buildBackendDetailsPath(backendId, tab);
  const search = backendId ? mergeScopeSearch('', { backend: backendId }).toString() : '';
  return { pathname, search: search ? `?${search}` : '' };
}

/** Investigation timeline with optional scope query. */
export function buildTimelineInvestigationSearch({ backendId, alertId } = {}) {
  return mergeScopeSearch('', {
    backend: backendId || '',
    alertId: alertId || '',
  }).toString();
}

export function buildTimelineInvestigationLocation({ backendId, alertId } = {}) {
  const search = buildTimelineInvestigationSearch({ backendId, alertId });
  return {
    pathname: '/app/investigate/timeline',
    search: search ? `?${search}` : '',
  };
}

export function buildDriftInvestigationLocation({ backendId, hours = 24 } = {}) {
  const search = mergeScopeSearch('', {
    backend: backendId || '',
    hours,
  }).toString();
  return {
    pathname: '/app/telemetry/drift',
    search: search ? `?${search}` : '',
  };
}
