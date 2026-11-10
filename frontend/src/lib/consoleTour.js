/** Guided console tour: expand the rail, then highlight regions on each common page. */

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
    path: '/app/overview',
    nav: 'home',
    title: 'Navigation',
    body: 'Observe, Execute, Record, and Configure. Labels stay visible for this walkthrough.',
    lesson: 'Collapsed rail shows icons only. Expand it when you need names.',
  },
  {
    target: 'nav-home',
    path: '/app/overview',
    nav: 'home',
    title: 'Fleet overview',
    body: 'Charts first: where alerts sit, queue depth, calibration age. The backend table is under them.',
  },
  {
    target: 'page-charts',
    path: '/app/overview',
    nav: 'home',
    title: 'Fleet charts',
    body: 'Alert pressure leads. Click a bar to open that backend. Counts are not repeated as tiles.',
  },
  {
    target: 'nav-operations',
    path: '/app/operate',
    nav: 'operations',
    title: 'Operator console',
    body: 'Work queue: acknowledge, investigate, then remediate. Not a second fleet dashboard.',
  },
  {
    target: 'page-ops-kpis',
    path: '/app/operate',
    nav: 'operations',
    title: 'Lane counts',
    body: 'Four lanes. Start with Acknowledgement if anything is unowned.',
  },
  {
    target: 'page-ops-focus',
    path: '/app/operate',
    nav: 'operations',
    title: 'Next item',
    body: 'Highest-priority row to act on now, with a link into the backend or incident.',
  },
  {
    target: 'nav-backends',
    path: '/app/backends/inventory',
    nav: 'backends',
    title: 'Backends',
    body: 'Registered QPUs. Filter by modality or provider, then open a row for qubits.',
  },
  {
    target: 'page-inventory',
    path: '/app/backends/inventory',
    nav: 'backends',
    title: 'Inventory summary',
    body: 'Online count, active alerts on those machines, and how many have stale telemetry.',
  },
  {
    target: 'nav-telemetry',
    path: '/app/telemetry/live',
    nav: 'telemetry',
    branch: 'telemetry',
    title: 'Telemetry',
    body: 'Live stream, calibration, drift, topology, anomalies. Nested pages sit under this item.',
  },
  {
    target: 'page-live-chart',
    path: '/app/telemetry/live',
    nav: 'telemetry',
    branch: 'telemetry',
    title: 'Live series',
    body: 'Alerts and queue depth on each platform refresh tick. Empty until the next tick arrives.',
  },
  {
    target: 'nav-execution',
    path: '/app/execution/jobs',
    nav: 'execution',
    branch: 'execution',
    title: 'Execution',
    body: 'Jobs already observed, and queue wait per backend. Not a job submitter.',
  },
  {
    target: 'page-jobs',
    path: '/app/execution/jobs',
    nav: 'execution',
    branch: 'execution',
    title: 'Job table',
    body: 'Status, runtime, and failure reason from stored execution records.',
  },
  {
    target: 'nav-alerts',
    path: '/app/alerts',
    nav: 'alerts',
    branch: 'alerts',
    title: 'Alerts',
    body: 'Sidebar badge is critical ACTIVE count. Incidents group the same rule on one backend.',
  },
  {
    target: 'page-alert-kpis',
    path: '/app/alerts',
    nav: 'alerts',
    branch: 'alerts',
    title: 'Alert summary',
    body: 'Active, critical, open incidents, unassigned. Use filters below before paging the list.',
  },
  {
    target: 'page-alert-filters',
    path: '/app/alerts',
    nav: 'alerts',
    branch: 'alerts',
    title: 'Triage list',
    body: 'Group by backend + rule. Expand a group to ack or resolve members. Calendar is another layout of the same set.',
    lesson: 'Grouped view is the default because one rule can fire on many qubits.',
  },
  {
    target: 'nav-platform',
    path: '/app/platform/health',
    nav: 'platform',
    title: 'Platform health',
    body: 'Collectors, database, adapter run time. This is the monitoring stack, not QPU calibration.',
  },
  {
    target: 'page-platform',
    path: '/app/platform/health',
    nav: 'platform',
    title: 'Collector status',
    body: 'Operational vs degraded. Open collectors in Configure if a provider is stale.',
  },
  {
    target: 'nav-admin',
    path: '/app/admin/integrations',
    nav: 'admin',
    branch: 'admin',
    title: 'Configure',
    body: 'Provider tokens, collection schedules, alert rules, users. Hidden if your role cannot manage the platform.',
  },
  {
    target: 'page-admin-providers',
    path: '/app/admin/integrations',
    nav: 'admin',
    branch: 'admin',
    title: 'Provider table',
    body: 'Adapter live vs stub, credentials present, last telemetry. LDAP bind is documented on this page when enabled.',
  },
  {
    target: 'quick-actions-dock',
    path: '/app/overview',
    nav: 'home',
    title: 'Shortcuts',
    body: 'Lower-right dock: restart this tour, platform setup, overview, operate, live telemetry.',
  },
];

assertTourContract(CONSOLE_TOUR_STEPS);
