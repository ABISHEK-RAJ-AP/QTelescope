import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardList,
  FileSearch,
  CalendarClock,
  Gauge,
  Layers,
  LayoutDashboard,
  Server,
  Shield,
  Sliders,
  UserCircle,
  Users,
} from 'lucide-react';

/**
 * Canonical QRP navigation — target taxonomy (Resource management / Governance / Operations).
 * `implemented: false` → ModulePlaceholder only; no fabricated metrics (OD-QRP-02 for quota/reservation).
 */
export const QRP_NAV_GROUPS = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { key: 'overview', label: 'Overview', route: '#/', icon: LayoutDashboard, implemented: true, permission: 'approvals:read' },
      { key: 'my-work', label: 'My Work', route: '#/my-work', icon: UserCircle, implemented: true, permission: 'approvals:read' },
      {
        key: 'approvals',
        label: 'Approvals',
        route: '#/queue',
        icon: ClipboardList,
        implemented: true,
        permission: 'approvals:read',
        badgeKey: 'queue',
      },
    ],
  },
  {
    id: 'resources',
    label: 'Resource management',
    items: [
      { key: 'inventory', label: 'Resource inventory', route: '#/inventory', icon: Boxes, implemented: true, permission: 'inventory:read' },
      {
        key: 'pools',
        label: 'Virtual resource pools',
        route: '#/pools',
        icon: Layers,
        implemented: true,
        permission: 'inventory:read',
      },
      {
        key: 'providers',
        label: 'Providers & facilities',
        route: '#/providers',
        icon: Server,
        implemented: true,
        permission: 'inventory:read',
      },
      {
        key: 'allocation',
        label: 'Allocation & orchestration',
        route: '#/allocation',
        icon: Gauge,
        implemented: true,
        permission: 'approvals:decide',
      },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    items: [
      {
        key: 'projects',
        label: 'Organizations & projects',
        route: '#/projects',
        icon: Users,
        implemented: true,
        permission: 'projects:read',
      },
      {
        key: 'policies',
        label: 'Policies & entitlements',
        route: '#/policies',
        icon: Sliders,
        implemented: true,
        permission: 'policies:read',
      },
      {
        key: 'capacity',
        label: 'Capacity & utilization',
        route: '#/capacity',
        icon: BarChart3,
        implemented: true,
        permission: 'metering:read',
      },
      {
        key: 'usage',
        label: 'Usage & metering',
        route: '#/usage',
        icon: BarChart3,
        implemented: true,
        permission: 'reports:read',
      },
      {
        key: 'reservations',
        label: 'Reservations',
        route: '#/reservations',
        icon: CalendarClock,
        implemented: true,
        permission: 'reservations:read',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        key: 'connectors',
        label: 'Provider health',
        route: '#/connectors',
        icon: Activity,
        implemented: true,
        permission: 'inventory:read',
      },
      { key: 'audit', label: 'Audit & evidence', route: '#/audit', icon: FileSearch, implemented: true, permission: 'approvals:read' },
      {
        key: 'access',
        label: 'Administration',
        route: '#/admin/access',
        icon: Shield,
        implemented: true,
        permission: 'users:read',
      },
    ],
  },
];

export function filterNavGroups(groups, permissions = []) {
  const set = new Set(permissions);
  const has = (perm) => !perm || set.has(perm) || set.has('platform:manage');
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => has(item.permission)),
    }))
    .filter((g) => g.items.length > 0);
}

export function matchGovernRoute(path) {
  if (!path || path === '/') return { key: 'overview', reviewId: null, assetId: null };
  if (path === '/my-work') return { key: 'my-work', reviewId: null };
  if (path === '/queue') return { key: 'approvals', reviewId: null };
  if (path.startsWith('/queue/')) return { key: 'approvals', reviewId: decodeURIComponent(path.slice('/queue/'.length)) };
  if (path === '/inventory') return { key: 'inventory', reviewId: null, assetId: null };
  if (path.startsWith('/inventory/')) {
    const assetId = decodeURIComponent(path.slice('/inventory/'.length).split('/')[0] || '');
    if (assetId) return { key: 'inventory', reviewId: null, assetId };
  }
  if (path === '/providers') return { key: 'providers', reviewId: null };
  if (path === '/projects') return { key: 'projects', reviewId: null, projectId: null };
  if (path.startsWith('/projects/')) {
    const projectId = decodeURIComponent(path.slice('/projects/'.length).split('/')[0] || '');
    if (projectId) return { key: 'projects', reviewId: null, projectId };
  }
  if (path === '/audit') return { key: 'audit', reviewId: null };
  const staticRoutes = ['pools', 'policies', 'capacity', 'usage', 'allocation', 'connectors', 'quotas', 'reservations'];
  for (const r of staticRoutes) {
    if (path === `/${r}`) return { key: r, reviewId: null };
  }
  if (path === '/admin/access') return { key: 'access', reviewId: null };
  if (path === '/admin/platform') return { key: 'platform', reviewId: null };
  if (path === '/403') return { key: 'forbidden', reviewId: null };
  return { key: 'unknown', unknown: true, reviewId: null, assetId: null };
}
