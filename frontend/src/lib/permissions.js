/** Mirror of app/core/permissions.py — keep in sync for UI gating. */

export const PERMISSIONS = {
  USERS_READ: 'users:read',
  ALERTS_ACK: 'alerts:acknowledge',
  ALERTS_RESOLVE: 'alerts:resolve',
  ALERTS_COMMENT: 'alerts:comment',
  INCIDENTS_UPDATE: 'incidents:update',
  INCIDENTS_RESOLVE: 'incidents:resolve',
  INCIDENTS_COMMENT: 'incidents:comment',
  INCIDENTS_ASSIGN: 'incidents:assign',
  ADMIN_PLATFORM: 'platform:manage',
  SECURITY_MANAGE: 'security:manage',
};

const READ_ONLY = new Set([
  'backends:read', 'telemetry:read', 'alerts:read', 'incidents:read', 'reports:read', 'platform:read', 'audit:read',
  'studio:read', 'projects:read', 'circuits:read', 'simulation:read',
]);

const DEV_STUDIO = new Set([
  'projects:read', 'projects:create', 'projects:update',
  'circuits:read', 'circuits:update',
  'simulation:read', 'simulation:run',
  'compilation:read', 'compilation:run',
  'preflight:read', 'preflight:run',
  'submissions:read', 'submissions:create', 'submissions:submit',
  'estimation:read', 'estimation:run',
  'studio:read',
]);

const GOVERNANCE = new Set(['approvals:read', 'approvals:decide']);

const OPS = new Set([
  ...READ_ONLY,
  'alerts:acknowledge', 'alerts:comment', 'alerts:resolve',
  'incidents:comment', 'incidents:update', 'incidents:resolve',
  'reports:export', 'executions:read',
]);

const INCIDENT_CMD = new Set([...OPS, 'incidents:assign', 'incidents:close']);

const OPS_ADMIN = new Set([
  ...OPS, ...DEV_STUDIO, ...GOVERNANCE,
  'backends:manage', 'alert_rules:read', 'alert_rules:manage', 'providers:manage', 'platform:manage', 'executions:submit',
]);

const SECURITY_ADMIN = new Set([
  'users:read', 'users:update', 'users:suspend', 'roles:assign',
  'security:read', 'security:manage', 'sessions:read', 'sessions:revoke',
  'audit:read', 'audit:export', 'platform:read',
  'alerts:read', 'incidents:read',
]);

const RESEARCH = new Set([
  ...READ_ONLY, ...DEV_STUDIO,
  'reports:export', 'alerts:comment', 'incidents:comment',
]);

const AUDITOR = new Set([
  'audit:read', 'audit:export', 'users:read', 'alerts:read', 'incidents:read', 'reports:read',
]);

/** null = full platform (SuperAdmin / Admin / PlatformAdmin). */
const ROLE_PERMS = {
  SuperAdmin: null,
  Admin: null,
  PlatformAdmin: null,
  Operator: new Set([...OPS, ...DEV_STUDIO]),
  OpsEngineer: OPS,
  IncidentCommander: INCIDENT_CMD,
  QuantumOpsAdmin: OPS_ADMIN,
  SecurityAdmin: SECURITY_ADMIN,
  Researcher: RESEARCH,
  ResearchAnalyst: RESEARCH,
  Auditor: AUDITOR,
  Viewer: READ_ONLY,
};

export const ROLE_DEFINITIONS = [
  { id: 'Viewer', label: 'Viewer', summary: 'Read-only observability and reports.' },
  { id: 'ResearchAnalyst', label: 'Research analyst', summary: 'Read fleet data; export reports; comment on alerts and incidents; developer studio access.' },
  { id: 'Researcher', label: 'Research analyst', summary: 'Alias for Research analyst.' },
  { id: 'OpsEngineer', label: 'Operations engineer', summary: 'Monitor fleet; acknowledge and resolve alerts; update incidents.' },
  { id: 'Operator', label: 'Operations engineer', summary: 'Alias for Operations engineer (includes studio).' },
  { id: 'IncidentCommander', label: 'Incident commander', summary: 'Full ops response including incident assignment and closure.' },
  { id: 'QuantumOpsAdmin', label: 'Quantum operations administrator', summary: 'Fleet configuration, alert rules, providers, and platform settings.' },
  { id: 'SecurityAdmin', label: 'Security administrator', summary: 'Users, roles, MFA policy, sessions, and audit exports.' },
  { id: 'SuperAdmin', label: 'Super administrator', summary: 'Unrestricted platform capabilities; can assign SuperAdmin.' },
  { id: 'PlatformAdmin', label: 'Platform administrator', summary: 'Unrestricted platform capabilities.' },
  { id: 'Admin', label: 'Platform administrator', summary: 'Alias for Platform administrator.' },
];

/** Matrix columns (capability bundles). */
export const RBAC_CAPABILITY_COLUMNS = [
  { id: 'observe', label: 'Observe', permission: 'telemetry:read' },
  { id: 'alert_ops', label: 'Alert actions', permission: 'alerts:acknowledge' },
  { id: 'incidents', label: 'Incident response', permission: 'incidents:update' },
  { id: 'incident_cmd', label: 'Incident command', permission: 'incidents:assign' },
  { id: 'configure', label: 'Configure platform', permission: 'platform:manage' },
  { id: 'security', label: 'Security & IAM', permission: 'security:manage' },
  { id: 'studio', label: 'Developer studio', permission: 'studio:read' },
];

const FULL_ACCESS_ROLES = new Set(['SuperAdmin', 'Admin', 'PlatformAdmin']);

export function permissionsForRole(role) {
  const set = ROLE_PERMS[role];
  if (set === null) return new Set(Object.values(PERMISSIONS));
  if (!set) return READ_ONLY;
  return set;
}

export function listPermissionsForRole(role) {
  if (FULL_ACCESS_ROLES.has(role)) return ['* (all capabilities)'];
  return [...permissionsForRole(role)].sort((a, b) => a.localeCompare(b));
}

export function roleHasCapability(role, permission) {
  if (FULL_ACCESS_ROLES.has(role)) return true;
  return permissionsForRole(role).has(permission);
}

export function roleLabel(role) {
  return ROLE_DEFINITIONS.find((r) => r.id === role)?.label || role || 'Unknown';
}

export function can(user, permission) {
  if (!user) return false;
  if (FULL_ACCESS_ROLES.has(user.role)) return true;
  const perms = user.permissions?.length
    ? new Set(user.permissions)
    : permissionsForRole(user.role);
  return perms.has(permission);
}

export function isPlatformAdmin(user) {
  return FULL_ACCESS_ROLES.has(user?.role);
}

export function canManageFleet(user) {
  return can(user, 'platform:manage') || can(user, 'providers:manage') || can(user, 'backends:manage');
}

export function canSeeNavItem(user, id) {
  if (id === 'settings' || id === 'onboarding') return Boolean(user);
  if (id === 'admin') {
    return canManageFleet(user) || can(user, 'alert_rules:read') || can(user, 'users:read');
  }
  if (id === 'home' || id === 'backends' || id === 'telemetry' || id === 'investigate' || id === 'resources') {
    return can(user, 'telemetry:read') || can(user, 'backends:read');
  }
  if (id === 'operations') return can(user, 'incidents:read') || can(user, 'alerts:read');
  if (id === 'platform') return can(user, 'platform:read');
  if (id === 'execution') return can(user, 'executions:read') || can(user, 'telemetry:read');
  if (id === 'reports') return can(user, 'reports:read');
  if (id === 'alerts') return can(user, 'alerts:read');
  if (id === 'compare') return can(user, 'telemetry:read') || can(user, 'backends:read');
  if (id === 'labs') return can(user, 'telemetry:read');
  return false;
}

export function visibleAdminNav(user) {
  return [
    (canManageFleet(user) ? { value: 'integrations', label: 'Integrations' } : null),
    (canManageFleet(user) ? { value: 'collectors', label: 'Collectors' } : null),
    (can(user, 'platform:read') || canManageFleet(user) ? { value: 'logs', label: 'Audit log' } : null),
    ((can(user, 'alert_rules:read') || can(user, 'alert_rules:manage')) ? { value: 'rules', label: 'Alert rules' } : null),
    (can(user, 'users:read') ? { value: 'users', label: 'Users & roles' } : null),
  ].filter(Boolean);
}

export function landingPathForRole(role) {
  if (FULL_ACCESS_ROLES.has(role) || role === 'QuantumOpsAdmin') return '/app/overview';
  if (role === 'SecurityAdmin') return '/app/admin/users';
  if (role === 'Auditor') return '/app/reports';
  if (role === 'Operator' || role === 'OpsEngineer' || role === 'IncidentCommander') return '/app/operate';
  return '/app/overview';
}

const PERM_DOMAIN_LABELS = {
  alerts: 'Alerts',
  incidents: 'Incidents',
  backends: 'Backends',
  telemetry: 'Telemetry',
  reports: 'Reports',
  platform: 'Platform',
  audit: 'Audit',
  studio: 'Developer studio',
  projects: 'Projects',
  circuits: 'Circuits',
  simulation: 'Simulation',
  compilation: 'Compilation',
  preflight: 'Preflight',
  submissions: 'Submissions',
  estimation: 'Estimation',
  executions: 'Executions',
  metering: 'Metering',
  quotas: 'Quotas',
  reservations: 'Reservations',
};

const PERM_ACTION_LABELS = {
  read: 'View',
  acknowledge: 'Acknowledge',
  resolve: 'Resolve',
  comment: 'Comment',
  update: 'Update',
  create: 'Create',
  run: 'Run',
  export: 'Export',
  submit: 'Submit',
  manage: 'Manage',
  assign: 'Assign',
  close: 'Close',
};

/** Operator-facing capability rows for account settings (not raw scope IDs). */
export function capabilityHighlightsForRole(role, extraPermissions = []) {
  const full = FULL_ACCESS_ROLES.has(role) || extraPermissions.some((p) => String(p).includes('*'));
  if (full) {
    return RBAC_CAPABILITY_COLUMNS.map((col) => ({ ...col, granted: true }));
  }
  const set = extraPermissions.length
    ? new Set(extraPermissions)
    : permissionsForRole(role);
  return RBAC_CAPABILITY_COLUMNS.map((col) => ({
    ...col,
    granted: set.has(col.permission),
  }));
}

export function roleSummaryText(role) {
  return ROLE_DEFINITIONS.find((r) => r.id === role)?.summary
    || 'Capabilities follow your assigned role.';
}

/** Group raw scopes by domain for an optional technical disclosure block. */
export function groupPermissionsByDomain(permissions) {
  const list = (permissions || []).filter((p) => p && !String(p).includes('*'));
  const groups = new Map();
  for (const perm of list) {
    const [domain, action] = String(perm).split(':');
    if (!domain) continue;
    if (!groups.has(domain)) groups.set(domain, []);
    const actionLabel = PERM_ACTION_LABELS[action] || (action ? action.replace(/_/g, ' ') : 'Access');
    groups.get(domain).push({ id: perm, label: actionLabel });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, actions]) => ({
      domain,
      title: PERM_DOMAIN_LABELS[domain] || domain.replace(/_/g, ' '),
      actions: actions.sort((a, b) => a.label.localeCompare(b.label)),
    }));
}
