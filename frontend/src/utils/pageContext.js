/** Route-aware page titles and breadcrumbs for the app shell (Sprint 1). */

const TELEMETRY_LABELS = {
  live: 'Live telemetry',
  calibration: 'Calibration status',
  drift: 'Drift analysis',
  trends: 'Historical trends',
  explorer: 'Metrics explorer',
  topology: 'Topology explorer',
  'cal-timeline': 'Calibration timeline',
  compare: 'Backend comparison',
  anomalies: 'Anomaly monitor',
  replay: 'Temporal replay',
  metrics: 'Metrics coverage',
};

const BACKEND_LABELS = {
  inventory: 'Backend library',
  qubits: 'Backend library',
  details: 'Backend workspace',
};

const EXECUTION_LABELS = {
  jobs: 'Job monitoring',
  queues: 'Queue monitoring',
};

const RESOURCE_LABELS = {
  health: 'Health vector',
  environment: 'Environment',
  capabilities: 'Device capabilities',
  metrics: 'Metrics coverage',
};

const ADMIN_LABELS = {
  hub: 'Integrations',
  integrations: 'Integrations',
  rules: 'Alert rules',
  collectors: 'Collectors',
  users: 'Users & roles',
};

const GROUP = {
  home: 'Overview',
  operations: 'Overview',
  platform: 'Platform',
  investigate: 'Investigate',
  backends: 'Fleet',
  telemetry: 'Analyze',
  execution: 'Execute',
  resources: 'Resources',
  reports: 'Record',
  alerts: 'Record',
  admin: 'Configure',
};

export function resolvePageContext(state) {
  const {
    mainTopic = 'home',
    backendSubTab,
    telemetrySubTab,
    executionSubTab,
    resourceSubTab,
    alertsView,
    adminSubTab,
    backendWorkspaceTab,
    selectedBackendId,
    selectedIncidentId,
    selectedAlertId,
  } = state;

  const group = GROUP[mainTopic] || 'Observe';
  const breadcrumbs = [{ label: group }];

  let title = 'Dashboard';
  let description = 'Fleet status, exceptions, and entry points to telemetry and alerts.';

  switch (mainTopic) {
    case 'home':
      breadcrumbs.push({ label: 'Fleet overview' });
      title = 'Fleet overview';
      description = 'Backend health, calibration age, queues, and platform KPIs at a glance.';
      break;
    case 'operations':
      breadcrumbs.push({ label: 'Operator console' });
      title = 'Operator console';
      description = 'Prioritized action queue: incidents, alerts, collectors, and backend advisories.';
      break;
    case 'platform':
      breadcrumbs.push({ label: 'Platform health' });
      title = 'Platform health';
      description = 'Database, collectors, ingestion freshness, and provider adapter performance.';
      break;
    case 'investigate':
      breadcrumbs.push({ label: 'Operations timeline' });
      title = 'Operations timeline';
      description = 'Alerts, incidents, and collector events on one timeline.';
      break;
    case 'backends': {
      const sub = backendSubTab || 'inventory';
      breadcrumbs.push({ label: 'Backends' });
      if (sub === 'details' && selectedBackendId) {
        breadcrumbs.push({ label: BACKEND_LABELS.inventory });
        const ws = backendWorkspaceTab && backendWorkspaceTab !== 'overview'
          ? ` · ${backendWorkspaceTab}`
          : '';
        title = `${selectedBackendId.replace(/_/g, ' ')}${ws}`;
        description = 'Overview, qubits, calibration, connectivity, execution, and alerts for this backend.';
      } else {
        title = BACKEND_LABELS.inventory;
        description = 'Registered QPUs, last telemetry age, alert counts, and queue depth. Open a row for qubits and calibration.';
      }
      break;
    }
    case 'telemetry': {
      const sub = telemetrySubTab || 'live';
      breadcrumbs.push({ label: 'Telemetry' });
      breadcrumbs.push({ label: TELEMETRY_LABELS[sub] || sub });
      title = TELEMETRY_LABELS[sub] || 'Telemetry';
      description = sub === 'live' ? 'Server-sent refresh stream and fleet-wide aggregates.' : 'Analysis over stored telemetry samples.';
      break;
    }
    case 'execution': {
      const sub = executionSubTab || 'jobs';
      breadcrumbs.push({ label: 'Execution' });
      breadcrumbs.push({ label: EXECUTION_LABELS[sub] || sub });
      title = EXECUTION_LABELS[sub] || 'Execution';
      description =
        sub === 'queues'
          ? 'Queue depth and wait estimates from backend telemetry.'
          : 'Observed job records and run outcomes.';
      break;
    }
    case 'resources': {
      const sub = resourceSubTab || 'health';
      breadcrumbs.push({ label: 'Resources' });
      breadcrumbs.push({ label: RESOURCE_LABELS[sub] || sub });
      title = RESOURCE_LABELS[sub] || 'Resources';
      description =
        sub === 'health'
          ? 'Fleet qubit health vector, trends, and routing recommendations.'
          : sub === 'environment'
            ? 'Facility and environmental measurements by backend.'
            : 'Provider and backend metric coverage matrix.';
      break;
    }
    case 'alerts':
      breadcrumbs.push({ label: 'Alerts' });
      if (selectedAlertId) {
        breadcrumbs.push({ label: 'Active alerts' });
        breadcrumbs.push({ label: 'Alert workspace' });
        title = 'Alert workspace';
        description = 'Threshold context, investigation links, RBAC-gated discussion, and response actions.';
      } else if (selectedIncidentId) {
        breadcrumbs.push({ label: 'Incidents' });
        breadcrumbs.push({ label: 'Incident workspace' });
        title = 'Incident workspace';
        description = 'Timeline, related alerts, discussion, and authorized response actions.';
      } else {
        breadcrumbs.push({ label: alertsView === 'incidents' ? 'Incidents' : 'Active alerts' });
        title = alertsView === 'incidents' ? 'Incidents' : 'Alerts';
        description =
          alertsView === 'incidents'
            ? 'Acknowledge, investigate, and resolve grouped incidents.'
            : 'Triage active alerts and jump to affected backends.';
      }
      break;
    case 'reports':
      breadcrumbs.push({ label: 'Reports' });
      breadcrumbs.push({ label: 'Evidence' });
      title = 'Reports & evidence';
      description = 'Exports and signed evidence snapshots for audit.';
      break;
    case 'settings':
      breadcrumbs.push({ label: 'Account' });
      breadcrumbs.push({ label: 'Settings' });
      title = 'Account settings';
      description = 'Profile, security, notifications, and preferences.';
      break;
    case 'admin': {
      const sub = adminSubTab || 'hub';
      breadcrumbs.push({ label: 'Configure' });
      breadcrumbs.push({ label: ADMIN_LABELS[sub] || sub });
      title = ADMIN_LABELS[sub] || 'Configure';
      if (sub === 'integrations') {
        description = 'Provider credentials, discovery, and adapter status.';
      } else if (sub === 'rules') {
        description = 'Alert threshold rules driven from stored telemetry.';
      } else if (sub === 'collectors') {
        description = 'Collection schedules, last run, and failure queue.';
      } else if (sub === 'users') {
        description = 'Directory, role assignment, and MFA enrollment status.';
      } else {
        description = 'Provider credentials, discovery, and adapter status.';
      }
      break;
    }
    default:
      break;
  }

  return {
    breadcrumbs: breadcrumbs.filter((c, i) => i === 0 || c.label !== breadcrumbs[i - 1].label),
    title,
    description,
    backendId: mainTopic === 'backends' && backendSubTab === 'details' ? selectedBackendId : null,
  };
}
