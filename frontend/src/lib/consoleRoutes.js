/** Static console destinations. Paths come from buildAppPath so the palette and tour cannot drift. */

import { buildAppPath } from '../appNav.js';

export const CONSOLE_ROUTES = [
  { id: 'overview', label: 'Overview', nav: 'home', group: 'Console', state: { mainTopic: 'home' } },
  { id: 'compare', label: 'Compare & routing', nav: 'compare', group: 'Console', state: { mainTopic: 'telemetry', telemetrySubTab: 'compare' } },
  { id: 'operate', label: 'Operator console', nav: 'operations', group: 'Labs', state: { mainTopic: 'operations', operationsSubTab: 'centre' } },
  { id: 'platform', label: 'Platform health', nav: 'platform', group: 'Labs', state: { mainTopic: 'platform' } },
  { id: 'inventory', label: 'Backend inventory', nav: 'backends', group: 'Observe', state: { mainTopic: 'backends', backendSubTab: 'inventory' } },
  { id: 'live', label: 'Live telemetry', nav: 'telemetry', group: 'Analyze', state: { mainTopic: 'telemetry', telemetrySubTab: 'live' } },
  { id: 'metrics-explorer', label: 'Metrics explorer', nav: 'telemetry', group: 'Analyze', state: { mainTopic: 'telemetry', telemetrySubTab: 'explorer' } },
  { id: 'calibration', label: 'Calibration status', nav: 'telemetry', group: 'Analyze', state: { mainTopic: 'telemetry', telemetrySubTab: 'calibration' } },
  { id: 'drift', label: 'Drift analysis', nav: 'telemetry', group: 'Analyze', state: { mainTopic: 'telemetry', telemetrySubTab: 'drift' } },
  { id: 'jobs', label: 'Job monitoring', nav: 'execution', group: 'Execute', state: { mainTopic: 'execution', executionSubTab: 'jobs' } },
  { id: 'queues', label: 'Queue monitoring', nav: 'execution', group: 'Execute', state: { mainTopic: 'execution', executionSubTab: 'queues' } },
  { id: 'alerts', label: 'Active alerts', nav: 'alerts', group: 'Record', state: { mainTopic: 'alerts', alertsView: 'alerts' } },
  { id: 'incidents', label: 'Open incidents', nav: 'alerts', group: 'Record', state: { mainTopic: 'alerts', alertsView: 'incidents' } },
  { id: 'timeline', label: 'Operations timeline', nav: 'investigate', group: 'Record', state: { mainTopic: 'investigate', investigateSubTab: 'timeline' } },
  { id: 'reports', label: 'Reports & evidence', nav: 'reports', group: 'Record', state: { mainTopic: 'reports' } },
  { id: 'settings', label: 'Account settings', nav: 'settings', group: 'Personal', state: { mainTopic: 'settings' } },
  { id: 'admin-int', label: 'Integrations', nav: 'admin', group: 'Configure', state: { mainTopic: 'admin', adminSubTab: 'integrations' } },
  { id: 'admin-coll', label: 'Collectors', nav: 'admin', group: 'Configure', state: { mainTopic: 'admin', adminSubTab: 'collectors' } },
  { id: 'admin-rules', label: 'Alert rules', nav: 'admin', group: 'Configure', state: { mainTopic: 'admin', adminSubTab: 'rules' } },
  { id: 'admin-users', label: 'Users & roles', nav: 'admin', group: 'Configure', state: { mainTopic: 'admin', adminSubTab: 'users' } },
  { id: 'admin-logs', label: 'Audit log', nav: 'admin', group: 'Configure', state: { mainTopic: 'admin', adminSubTab: 'logs' } },
];

export function consolePath(id) {
  const row = CONSOLE_ROUTES.find((r) => r.id === id);
  if (!row) throw new Error(`unknown console route ${id}`);
  return buildAppPath(row.state);
}

export function consoleCommands() {
  return CONSOLE_ROUTES.map((row) => ({
    id: row.id,
    label: row.label,
    path: buildAppPath(row.state),
    nav: row.nav,
    group: row.group,
  }));
}
