/** Maps providers to collected signals and console destinations. */

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
    title: 'Fleet overview',
    body: 'Backends ranked by alerts, queue depth, and calibration age. Demo catalog rows are labeled as demo.',
    accent: '#0284c7',
    bullets: [
      'Open a backend for qubits, calibration, connectivity, and jobs',
      'GREEN / YELLOW / RED per qubit; RED means skip scheduling',
      'Stale collectors listed apart from live adapters',
    ],
  },
  {
    id: 'operate',
    tag: 'Telemetry',
    title: 'Source and age on every series',
    body: 'Vendor APIs, last good snapshot, and lab simulation use different labels. A chart with no timestamp is empty, not zero.',
    accent: '#7c3aed',
    bullets: [
      'T1 / T2 in microseconds; compare only within the same modality',
      'Calibration Fresh, Aging, or Stale',
      'Platform health covers collectors, not QPU drift',
    ],
  },
  {
    id: 'act',
    tag: 'Operations',
    title: 'Alerts, incidents, and queues',
    body: 'Acknowledge and resolve from Alerts. Operator console lists unowned groups, degraded backends, and collector faults.',
    accent: '#059669',
    bullets: [
      'Queue depth and job failures feed the overview health score',
      'Timeline events open the backend workspace',
      'Reports keep provenance hashes for audit',
    ],
  },
];

export const CONNECT_GUIDE = [
  { n: '01', title: 'Select providers', body: 'IBM Quantum, Rigetti, IonQ, or C-DAC/on-prem. Each one is optional.' },
  { n: '02', title: 'Store credentials', body: 'Tokens stay on the server. Saved secrets are not shown again.' },
  { n: '03', title: 'Run discovery', body: 'Next step refreshes catalog, metrics coverage, and collector status.' },
  { n: '04', title: 'Skip if needed', body: 'Demo catalog works without keys. Add credentials later under Configure, Integrations.' },
];

export const ONBOARDING_FAQ = [
  {
    q: 'Do I need all provider keys before using the console?',
    a: 'No. Skip Connect to use seeded demo backends. Admins save live keys; other roles use the shared catalog.',
  },
  {
    q: 'Where are provider tokens stored?',
    a: 'On the platform server. Updates use authenticated HTTPS. Saved secrets are not shown again.',
  },
  {
    q: 'What does discovery do?',
    a: 'It refreshes backend inventory, metric coverage, fleet KPIs, and (for Admins) may poll configured providers.',
  },
  {
    q: 'Can I run platform setup again later?',
    a: 'Yes. Configure, Integrations, Platform setup, or Shortcuts, Platform setup in the dock.',
  },
];

export const ONBOARDING_WORKFLOW = [
  { n: '01', title: 'Connect backends', body: 'Cloud tokens or lab URLs. Simulators need no credentials.' },
  { n: '02', title: 'Check telemetry', body: 'Live adapters, calibration snapshots, metrics coverage.' },
  { n: '03', title: 'Run the shift', body: 'Overview, then alerts, then the backend that needs work.' },
  { n: '04', title: 'Audit', body: 'Reports, replay, and platform health after an incident.' },
];

/** What the platform can ingest (shown after discovery). */
export const COLLECTION_LANES = [
  {
    id: 'coherence',
    label: 'Coherence and gate metrics',
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
    detail: 'Fresh / aging / stale records and timelines',
    providers: ['IBM Quantum', 'Rigetti', 'Platform DB'],
    routes: [
      { label: 'Calibration status', path: '/app/telemetry/calibration' },
      { label: 'Calibration timeline', path: '/app/telemetry/cal-timeline' },
    ],
  },
  {
    id: 'execution',
    label: 'Queues and jobs',
    detail: 'Depth, wait times, outcomes, failures',
    providers: ['IBM Quantum', 'Rigetti', 'IonQ'],
    routes: [
      { label: 'Job monitoring', path: '/app/execution/jobs' },
      { label: 'Queue monitoring', path: '/app/execution/queues' },
    ],
  },
  {
    id: 'topology',
    label: 'Topology and coupling',
    detail: 'Coupling map, compare backends, replay',
    providers: ['Discovered backends'],
    routes: [
      { label: 'Topology explorer', path: '/app/telemetry/topology' },
      { label: 'Backend comparison', path: '/app/telemetry/compare' },
      { label: 'Temporal replay', path: '/app/telemetry/replay' },
    ],
  },
  {
    id: 'ops',
    label: 'Ops and evidence',
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
    description: 'Alerts, incidents, pending jobs, calibration age, health charts.',
    path: '/app/overview',
    tourTarget: 'nav-home',
  },
  {
    id: 'operate',
    title: 'Operator console',
    description: 'Merged alerts, incidents, collector status.',
    path: '/app/operate',
    tourTarget: 'nav-operations',
  },
  {
    id: 'backends',
    title: 'Backend inventory',
    description: 'Filter by provider, modality, and status.',
    path: '/app/backends/inventory',
    tourTarget: 'nav-backends',
  },
  {
    id: 'telemetry',
    title: 'Telemetry',
    description: 'Live SSE, drift, trends, anomalies, metric registry.',
    path: '/app/telemetry/live',
    tourTarget: 'nav-telemetry',
  },
  {
    id: 'alerts',
    title: 'Alerts and incidents',
    description: 'Acknowledge, correlate, open the backend workspace.',
    path: '/app/alerts',
    tourTarget: 'nav-alerts',
  },
  {
    id: 'admin',
    title: 'Admin and integrations',
    description: 'Credentials, schedules, collectors, alert rules.',
    path: '/app/admin',
    tourTarget: 'nav-admin',
    adminOnly: true,
  },
];

export { CONSOLE_TOUR_STEPS, filterConsoleTourSteps } from './consoleTour.js';

export const ANALYSIS_PHASES = [
  { id: 'registry', label: 'Reading provider registry' },
  { id: 'catalog', label: 'Scanning backend catalog' },
  { id: 'calibration', label: 'Indexing calibration snapshots' },
  { id: 'queues', label: 'Syncing queue and job telemetry' },
  { id: 'metrics', label: 'Building metrics coverage map' },
  { id: 'health', label: 'Checking collector health' },
];
