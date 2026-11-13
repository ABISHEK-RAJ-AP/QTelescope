/** Guided console tour: expand the rail, then highlight regions on each common page. */

import { consolePath } from './consoleRoutes.js';

export function filterConsoleTourSteps(user, canSeeNavItem) {
  return CONSOLE_TOUR_STEPS.filter((s) => !s.nav || canSeeNavItem(user, s.nav));
}

function assertTourContract(steps) {
  for (const s of steps) {
    if (!s.target || !s.title || !s.body || !s.path) {
      throw new Error(`console tour step incomplete: ${s.target || '(missing target)'}`);
    }
  }
}

export const CONSOLE_TOUR_STEPS = [
  {
    target: 'sidebar-nav',
    path: consolePath('overview'),
    nav: 'home',
    title: 'Navigation',
    body: 'Observe, Execute, Record, and Configure. Labels stay visible for this walkthrough.',
    lesson: 'Collapsed rail shows icons only. Expand it when you need names.',
  },
  {
    target: 'nav-home',
    path: consolePath('overview'),
    nav: 'home',
    title: 'Fleet overview',
    body: 'KPIs and charts show fleet health, queue depth, and calibration age. Open a backend from the table below.',
  },
  {
    target: 'page-charts',
    path: consolePath('overview'),
    nav: 'home',
    title: 'Fleet charts',
    body: 'Alert pressure leads. Click a bar to open that backend. Counts are not repeated as tiles.',
  },
  {
    target: 'nav-operations',
    path: consolePath('operate'),
    nav: 'operations',
    title: 'Operator console',
    body: 'Work queue: acknowledge, investigate, then remediate — prioritized by lane.',
  },
  {
    target: 'page-ops-kpis',
    path: consolePath('operate'),
    nav: 'operations',
    title: 'Lane counts',
    body: 'Four lanes. Start with Acknowledgement if anything is unowned.',
  },
  {
    target: 'page-ops-focus',
    path: consolePath('operate'),
    nav: 'operations',
    title: 'Next item',
    body: 'Highest-priority row to act on now, with a link into the backend or incident.',
  },
  {
    target: 'nav-backends',
    path: consolePath('inventory'),
    nav: 'backends',
    title: 'Backends',
    body: 'Registered QPUs. Filter by modality or provider, then open a row for qubits.',
  },
  {
    target: 'page-inventory',
    path: consolePath('inventory'),
    nav: 'backends',
    title: 'Inventory summary',
    body: 'Online count, active alerts on those machines, and how many have stale telemetry.',
  },
  {
    target: 'nav-telemetry',
    path: consolePath('live'),
    nav: 'telemetry',
    branch: 'telemetry',
    title: 'Telemetry',
    body: 'Live stream, calibration, drift, topology, anomalies. Nested pages sit under this item.',
  },
  {
    target: 'page-live-chart',
    path: consolePath('live'),
    nav: 'telemetry',
    branch: 'telemetry',
    title: 'Live series',
    body: 'Alerts and queue depth on each platform refresh tick. Empty until the next tick arrives.',
  },
  {
    target: 'nav-execution',
    path: consolePath('jobs'),
    nav: 'execution',
    branch: 'execution',
    title: 'Execution',
    body: 'Jobs already observed, and queue wait per backend. Not a job submitter.',
  },
  {
    target: 'page-jobs',
    path: consolePath('jobs'),
    nav: 'execution',
    branch: 'execution',
    title: 'Job table',
    body: 'Status, runtime, and failure reason from stored execution records.',
  },
  {
    target: 'nav-alerts',
    path: consolePath('alerts'),
    nav: 'alerts',
    branch: 'alerts',
    title: 'Alerts',
    body: 'Sidebar badge is critical ACTIVE count. Incidents group the same rule on one backend.',
  },
  {
    target: 'page-alert-kpis',
    path: consolePath('alerts'),
    nav: 'alerts',
    branch: 'alerts',
    title: 'Alert summary',
    body: 'Active, critical, open incidents, unassigned. Use filters below before paging the list.',
  },
  {
    target: 'page-alert-filters',
    path: consolePath('alerts'),
    nav: 'alerts',
    branch: 'alerts',
    title: 'Triage list',
    body: 'Filter the list, then open a card for the alert. Calendar is another layout of the same set.',
    lesson: 'Each card is one alert. Ack or resolve from the card or the detail view.',
  },
  {
    target: 'nav-platform',
    path: consolePath('platform'),
    nav: 'platform',
    title: 'Platform health',
    body: 'Collectors, database, adapter run time. This is the monitoring stack, not QPU calibration.',
  },
  {
    target: 'page-platform',
    path: consolePath('platform'),
    nav: 'platform',
    title: 'Collector status',
    body: 'Operational vs degraded. Open collectors in Configure if a provider is stale.',
  },
  {
    target: 'nav-admin',
    path: consolePath('admin-int'),
    nav: 'admin',
    branch: 'admin',
    title: 'Configure',
    body: 'Provider tokens, collection schedules, alert rules, users. Hidden if your role cannot manage the platform.',
  },
  {
    target: 'page-admin-providers',
    path: consolePath('admin-int'),
    nav: 'admin',
    branch: 'admin',
    title: 'Provider table',
    body: 'Adapter live vs stub, credentials present, last telemetry. LDAP bind is documented on this page when enabled.',
  },
  {
    target: 'quick-actions-dock',
    path: consolePath('overview'),
    nav: 'home',
    title: 'Shortcuts',
    body: 'Lower-right dock: restart this tour, platform setup, overview, operate, live telemetry.',
  },
];

assertTourContract(CONSOLE_TOUR_STEPS);
