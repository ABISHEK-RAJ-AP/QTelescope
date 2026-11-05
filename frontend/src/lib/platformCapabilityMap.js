/** Maps providers → collected signals → console destinations (onboarding + tour). */

export const PROVIDER_IDS = {
  ibm: 'ibm_quantum',
  rigetti: 'rigetti_quantum',
  ionq: 'ionq_quantum',
  cdac: 'cdac_quantum',
};

export const INTRO_SLIDES = [
  {
    id: 'observe',
    tag: 'Observe',
    title: 'Start the shift on fleet health, not a marketing summary',
    body: 'The overview ranks each backend by router state, alert load, queue depth, and calibration age. Demo catalog rows stay labeled — they are not live QPU feeds.',
    accent: '#0284c7',
    bullets: [
      'Open a backend for qubits, calibration, connectivity, and execution on that machine',
      'Health vector rolls GREEN / YELLOW / RED per qubit; RED means do not schedule',
      'Stale collectors and cached snapshots are shown separately from live adapters',
    ],
  },
  {
    id: 'operate',
    tag: 'Telemetry',
    title: 'Every series names its source and age',
    body: 'Live vendor APIs, last successful snapshot, and simulated lab data use different labels. Charts without a timestamp are empty, not zero.',
    accent: '#7c3aed',
    bullets: [
      'T1 / T2 in microseconds; compare only within the same modality',
      'Calibration Fresh → Aging → Stale drives which backends to trust this hour',
      'Platform health isolates a dead collector from actual QPU drift',
    ],
  },
  {
    id: 'act',
    tag: 'Operations',
    title: 'Alerts become incidents; jobs stay on the queue they came from',
    body: 'Acknowledge and resolve from Alerts. Operator console merges unowned groups, degraded backends, and collector faults for handoff.',
    accent: '#059669',
    bullets: [
      'Queue depth and job failures feed the same health score used on overview',
      'Timeline events link back to the backend workspace, not a dead-end modal',
      'Reports and evidence export keep provenance hashes for audit',
    ],
  },
];

export const CONNECT_GUIDE = [
  { n: '01', title: 'Select providers', body: 'IBM Quantum, Rigetti, IonQ, or C-DAC/on-prem — each integration is optional.' },
  { n: '02', title: 'Store credentials', body: 'Tokens are held on the server; saved secrets are not shown again in the form.' },
  { n: '03', title: 'Run discovery', body: 'The next step refreshes catalog, metrics coverage, and collector status.' },
  { n: '04', title: 'Optional skip', body: 'The demo catalog runs without keys. Add credentials later under Configure → Integrations.' },
];

export const ONBOARDING_FAQ = [
  {
    q: 'Do I need all provider keys before using the console?',
    a: 'No. Skip Connect to use seeded demo backends, then add live credentials when ready. Admins save keys; other roles can browse and operate on shared catalog data.',
  },
  {
    q: 'Where are provider tokens stored?',
    a: 'On the platform server in the credentials store. Updates use authenticated HTTPS; saved secrets are not shown again in the form.',
  },
  {
    q: 'What does discovery actually do?',
    a: 'It refreshes backend inventory, metric capabilities, fleet summary KPIs, and (for Admins) may trigger auto-discovery against configured providers.',
  },
  {
    q: 'Can I run platform setup again later?',
    a: 'Yes — Configure → Integrations → Platform setup, or Shortcuts → Platform setup in the console dock.',
  },
];

export const ONBOARDING_WORKFLOW = [
  { n: '01', title: 'Connect fleet backends', body: 'Register cloud tokens or lab endpoints; simulators need no credentials.' },
  { n: '02', title: 'Validate telemetry', body: 'Confirm live adapters, calibration snapshots, and metrics coverage.' },
  { n: '03', title: 'Operate the shift', body: 'Overview → alerts → backend workspace when a QPU needs attention.' },
  { n: '04', title: 'Improve & audit', body: 'Reports, replay, and platform health for post-incident review.' },
];

/** What the platform can ingest (shown after discovery). */
export const COLLECTION_LANES = [
  {
    id: 'coherence',
    label: 'Coherence & gate metrics',
    detail: 'T1, T2, readout error, gate fidelities per qubit',
    providers: ['IBM Quantum', 'Rigetti', 'IonQ', 'C-DAC / on-prem', 'Simulators'],
    routes: [
      { label: 'Live telemetry', path: '/app/telemetry/live' },
      { label: 'Backend library', path: '/app/backends/inventory' },
      { label: 'Metrics coverage', path: '/app/telemetry/metrics' },
    ],
  },
  {
    id: 'calibration',
    label: 'Calibration snapshots',
    detail: 'Fresh / aging / stale calibration records and timelines',
    providers: ['IBM Quantum', 'Rigetti', 'Platform DB'],
    routes: [
      { label: 'Calibration status', path: '/app/telemetry/calibration' },
      { label: 'Calibration timeline', path: '/app/telemetry/cal-timeline' },
    ],
  },
  {
    id: 'execution',
    label: 'Queues & jobs',
    detail: 'Depth, wait times, job outcomes and failure analytics',
    providers: ['IBM Quantum', 'Rigetti', 'IonQ'],
    routes: [
      { label: 'Job monitoring', path: '/app/execution/jobs' },
      { label: 'Queue monitoring', path: '/app/execution/queues' },
    ],
  },
  {
    id: 'topology',
    label: 'Topology & coupling',
    detail: 'Coupling map, compare backends, temporal replay',
    providers: ['Discovered backends'],
    routes: [
      { label: 'Topology explorer', path: '/app/telemetry/topology' },
      { label: 'Backend comparison', path: '/app/telemetry/compare' },
      { label: 'Temporal replay', path: '/app/telemetry/replay' },
    ],
  },
  {
    id: 'ops',
    label: 'Ops & evidence',
    detail: 'Alerts, incidents, reports, federated snapshots',
    providers: ['Platform collectors'],
    routes: [
      { label: 'Alerts', path: '/app/alerts' },
      { label: 'Operator console', path: '/app/operate' },
      { label: 'Reports', path: '/app/reports' },
    ],
  },
];

export const PRODUCT_FEATURES = [
  {
    id: 'overview',
    title: 'Fleet overview',
    description: 'Active alerts, incidents, pending jobs, calibration age, and health charts for this shift.',
    path: '/app/overview',
    tourTarget: 'nav-home',
  },
  {
    id: 'operate',
    title: 'Operator console',
    description: 'Merged alerts, incidents, and collector status for shift handoff.',
    path: '/app/operate',
    tourTarget: 'nav-operations',
  },
  {
    id: 'backends',
    title: 'Backend inventory',
    description: 'Filter by provider, modality, and operational status.',
    path: '/app/backends/inventory',
    tourTarget: 'nav-backends',
  },
  {
    id: 'telemetry',
    title: 'Telemetry workspaces',
    description: 'Live SSE, drift, trends, anomalies, and metric registry.',
    path: '/app/telemetry/live',
    tourTarget: 'nav-telemetry',
  },
  {
    id: 'alerts',
    title: 'Alerts & incidents',
    description: 'Acknowledge, correlate, and trace to backend workspace.',
    path: '/app/alerts',
    tourTarget: 'nav-alerts',
  },
  {
    id: 'admin',
    title: 'Admin & integrations',
    description: 'Credentials, schedules, collectors, and alert rules.',
    path: '/app/admin',
    tourTarget: 'nav-admin',
    adminOnly: true,
  },
];

export const CONSOLE_TOUR_STEPS = [
  {
    target: 'nav-home',
    title: 'Fleet overview',
    body: 'Start here each shift: fleet health, stale calibrations, and the ops timeline surface what needs attention.',
  },
  {
    target: 'nav-operations',
    title: 'Operator console',
    body: 'Correlate alerts, open incidents, and collector faults without jumping across disconnected pages.',
  },
  {
    target: 'nav-backends',
    title: 'Backends',
    body: 'Inventory every QPU and simulator; open a backend workspace for qubit-level detail.',
  },
  {
    target: 'nav-telemetry',
    title: 'Telemetry',
    body: 'Live SSE streams, calibration, drift, topology, and metrics coverage — pick the lens for your investigation.',
  },
  {
    target: 'nav-alerts',
    title: 'Alerts',
    body: 'Active and critical counts stay in the sidebar badge; resolve or promote to incidents from here.',
  },
  {
    target: 'nav-platform',
    title: 'Platform health',
    body: 'Adapter runs, database mode, and collector DLQ — platform services, not QPU calibration.',
  },
  {
    target: 'quick-actions-dock',
    title: 'Shortcuts',
    body: 'Bottom-right dock: guided tour, platform setup, and links to telemetry, alerts, and admin.',
  },
];

export const ANALYSIS_PHASES = [
  { id: 'registry', label: 'Reading provider registry' },
  { id: 'catalog', label: 'Scanning backend catalog' },
  { id: 'calibration', label: 'Indexing calibration snapshots' },
  { id: 'queues', label: 'Syncing queue & job telemetry' },
  { id: 'metrics', label: 'Building metrics coverage map' },
  { id: 'health', label: 'Checking collector health' },
];
