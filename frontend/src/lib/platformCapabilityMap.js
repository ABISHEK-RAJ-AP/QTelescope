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
    tag: 'Fleet overview',
    title: 'Single console for the QPU fleet',
    body: 'Inventory, live telemetry, calibration age, and health vectors for superconducting QPUs, simulators, and lab testbeds.',
    accent: '#0284c7',
    bullets: [
      'One registry for IBM, Rigetti, IonQ, C-DAC, and local simulators',
      'SSE telemetry with collector status and data-source labels',
      'Calibration freshness (Fresh through Stale) on each backend',
    ],
    highlights: [
      { label: 'Signal lanes', value: '5+' },
      { label: 'Modalities', value: 'QPU · sim · lab' },
      { label: 'Console views', value: 'Inventory · telemetry · ops' },
    ],
  },
  {
    id: 'operate',
    tag: 'Telemetry provenance',
    title: 'Telemetry with clear data source',
    body: 'Live vendor feeds, cached snapshots, and demo data are labeled so operators know what each panel reflects.',
    accent: '#7c3aed',
    bullets: [
      'Live, cached, and synthesized series marked in the UI',
      'Metrics coverage shows gaps before analysis',
      'Platform health isolates collector issues from QPU drift',
    ],
    highlights: [
      { label: 'Ingest modes', value: 'Live · cached · demo' },
      { label: 'Streams', value: 'SSE telemetry' },
      { label: 'Ops surface', value: 'Timeline · DLQ' },
    ],
  },
  {
    id: 'act',
    tag: 'Operations',
    title: 'Incidents, queues, and drift',
    body: 'Alerts feed incidents, the ops timeline ties collector events to backends, and investigation views keep workspace context.',
    accent: '#059669',
    bullets: [
      'Alerts promote to incidents with backend workspace context',
      'Queue depth and job failures feed health scoring',
      'Reports and federated snapshots for audit handoff',
    ],
    highlights: [
      { label: 'Workflow', value: 'Alert → incident' },
      { label: 'Execution', value: 'Jobs · queues' },
      { label: 'Evidence', value: 'Reports · replay' },
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
    description: 'KPI strip, coherence charts, ops timeline, and attention queue.',
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
