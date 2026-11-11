/**
 * Launch IA: 5 primary destinations + Settings + Labs (Material rail ≤7).
 * Legacy deep links unchanged; Labs holds former sprawl.
 */
import {
  TELEMETRY_NAV,
  EXECUTION_NAV,
  RESOURCES_NAV,
  ALERTS_NAV,
  NAV_HELP,
} from './appSidebarNav.js';

/** @typedef {{ value: string, label: string, target?: object }} NavChild */

export const ALERTS_HUB_NAV = [
  ...ALERTS_NAV,
  { value: 'operate', label: 'Action queue', target: { mainTopic: 'operations', operationsSubTab: 'centre' } },
  { value: 'timeline', label: 'Timeline', target: { mainTopic: 'investigate', investigateSubTab: 'timeline' } },
];

export const LABS_TELEMETRY_NAV = TELEMETRY_NAV.filter((t) => t.value !== 'compare');

export const NAV_HELP_PRIMARY = {
  ...NAV_HELP,
  home: 'Is the fleet healthy? Status, exceptions, and what needs you first.',
  backends: 'All QPUs in one table — open a row for health, queue, and alerts.',
  alerts: 'Grouped alert inbox, incidents, action queue, and timeline.',
  compare: 'Cross-vendor compare and routing recommendation.',
  labs: 'Advanced telemetry, execution, and platform tools.',
};

/** Resolve child click → shell state patch */
export function navChildGoState(branchId, child) {
  if (child.target) return { ...child.target };
  switch (branchId) {
    case 'telemetry':
      return { mainTopic: 'telemetry', telemetrySubTab: child.value };
    case 'execution':
      return { mainTopic: 'execution', executionSubTab: child.value };
    case 'resources':
      return { mainTopic: 'resources', resourceSubTab: child.value };
    case 'alerts':
      return {
        mainTopic: 'alerts',
        alertsView: child.value,
        selectedAlertId: '',
        selectedIncidentId: '',
      };
    case 'admin':
      return { mainTopic: 'admin', adminSubTab: child.value };
    default:
      return { mainTopic: branchId };
  }
}

export function navChildIsActive(branchId, child, state) {
  if (child.target) {
    const t = child.target;
    return Object.entries(t).every(([k, v]) => state[k] === v);
  }
  const { mainTopic, telemetrySubTab, executionSubTab, resourceSubTab, alertsView, adminSubTab } = state;
  switch (branchId) {
    case 'telemetry':
      return mainTopic === 'telemetry' && telemetrySubTab === child.value;
    case 'execution':
      return mainTopic === 'execution' && executionSubTab === child.value;
    case 'resources':
      return mainTopic === 'resources' && resourceSubTab === child.value;
    case 'alerts':
      return (
        mainTopic === 'alerts'
        && alertsView === child.value
        && !state.selectedAlertId
        && !state.selectedIncidentId
      );
    case 'admin':
      return mainTopic === 'admin' && adminSubTab === child.value;
    default:
      return false;
  }
}

export function navBranchIsActive(branchId, state, { hasChildren = true } = {}) {
  if (!hasChildren) return state.mainTopic === branchId;
  switch (branchId) {
    case 'telemetry':
      return state.mainTopic === 'telemetry';
    case 'execution':
      return state.mainTopic === 'execution';
    case 'resources':
      return state.mainTopic === 'resources';
    case 'alerts':
      return state.mainTopic === 'alerts' || state.mainTopic === 'operations' || state.mainTopic === 'investigate';
    case 'admin':
      return state.mainTopic === 'admin';
    case 'platform':
      return state.mainTopic === 'platform';
    case 'operations':
      return state.mainTopic === 'operations';
    case 'investigate':
      return state.mainTopic === 'investigate';
    default:
      return state.mainTopic === branchId;
  }
}

export function defaultBranchGoState(branchId, children = []) {
  const first = children[0];
  if (!first) return { mainTopic: branchId };
  return navChildGoState(branchId, first);
}
