/** Sidebar groups: top-level routes and nested pages (replaces in-content tab bars). */

export const TELEMETRY_NAV = [
  { value: 'live', label: 'Live telemetry' },
  { value: 'calibration', label: 'Calibration status' },
  { value: 'drift', label: 'Drift analysis' },
  { value: 'trends', label: 'Historical trends' },
  { value: 'topology', label: 'Topology explorer' },
  { value: 'cal-timeline', label: 'Calibration timeline' },
  { value: 'compare', label: 'Backend comparison' },
  { value: 'anomalies', label: 'Anomaly monitor' },
  { value: 'replay', label: 'Temporal replay' },
  { value: 'metrics', label: 'Metrics coverage' },
];

export const EXECUTION_NAV = [
  { value: 'jobs', label: 'Job monitoring' },
  { value: 'queues', label: 'Queue monitoring' },
];

export const RESOURCES_NAV = [
  { value: 'health', label: 'Health vector' },
  { value: 'environment', label: 'Environment' },
];

export const ALERTS_NAV = [
  { value: 'alerts', label: 'Active alerts' },
  { value: 'incidents', label: 'Incidents' },
];

export const ADMIN_NAV = [
  { value: 'integrations', label: 'Integrations' },
  { value: 'collectors', label: 'Collectors' },
  { value: 'rules', label: 'Alert rules' },
  { value: 'users', label: 'Users & roles' },
];

/** @returns {boolean} whether any child of this nav branch matches current shell state */
export function navBranchActive(item, state) {
  const { mainTopic, telemetrySubTab, executionSubTab, resourceSubTab, alertsView, adminSubTab } = state;
  if (!item.children?.length) return mainTopic === item.id;
  switch (item.id) {
    case 'telemetry':
      return mainTopic === 'telemetry';
    case 'execution':
      return mainTopic === 'execution';
    case 'resources':
      return mainTopic === 'resources';
    case 'alerts':
      return mainTopic === 'alerts';
    case 'admin':
      return mainTopic === 'admin';
    default:
      return mainTopic === item.id;
  }
}

export function navChildActive(item, child, state) {
  const { mainTopic, telemetrySubTab, executionSubTab, resourceSubTab, alertsView, adminSubTab } = state;
  switch (item.id) {
    case 'telemetry':
      return mainTopic === 'telemetry' && telemetrySubTab === child.value;
    case 'execution':
      return mainTopic === 'execution' && executionSubTab === child.value;
    case 'resources':
      return mainTopic === 'resources' && resourceSubTab === child.value;
    case 'alerts':
      return mainTopic === 'alerts' && alertsView === child.value && !state.selectedAlertId && !state.selectedIncidentId;
    case 'admin':
      return mainTopic === 'admin' && adminSubTab === child.value;
    default:
      return false;
  }
}

export function goStateForNavChild(item, child) {
  switch (item.id) {
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
      return { mainTopic: item.id };
  }
}

export function defaultGoStateForBranch(item) {
  const first = item.children?.[0];
  if (!first) return { mainTopic: item.id };
  return goStateForNavChild(item, first);
}
