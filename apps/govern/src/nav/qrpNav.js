import {
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
  Users,
} from 'lucide-react';

/**
 * Canonical QRP nav — enterprise IA (WORKSPACE · RESOURCE OPS · GOVERNANCE · ADMIN).
 * Permission keys unchanged; filterNavGroups behavior unchanged.
 */
export const QRP_IA_GROUP_META = {
  workspace: { label: 'Workspace', hash: '#/' },
  'resource-ops': { label: 'Resource operations' },
  governance: { label: 'Governance' },
  administration: { label: 'Administration', hash: '#/admin/access' },
};

export function buildQrpBreadcrumbs(groupId, pageLabel) {
  const meta = QRP_IA_GROUP_META[groupId] || { label: String(groupId) };
  const trail = [];
  if (meta.hash) trail.push({ label: meta.label, hash: meta.hash });
  else trail.push({ label: meta.label });
  trail.push({ label: pageLabel });
  return trail;
}

export const QRP_NAV_GROUPS = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { key: 'overview', label: 'Overview', route: '#/', icon: LayoutDashboard, implemented: true, permission: 'approvals:read' },
      {
        key: 'approvals',
        label: 'Review queue',
        route: '#/queue',
        icon: ClipboardList,
        implemented: true,
        permission: 'approvals:read',
        badgeKey: 'queue',
      },
      {
        key: 'my-work',
        label: 'My work',
        route: '#/my-work',
        icon: ClipboardList,
        implemented: true,
        permission: 'approvals:read',
      },
      {
        key: 'projects',
        label: 'Projects',
        route: '#/projects',
        icon: Users,
        implemented: true,
        permission: 'projects:read',
      },
    ],
  },
  {
    id: 'resource-ops',
    label: 'Resource operations',
    items: [
      { key: 'inventory', label: 'Inventory', route: '#/inventory', icon: Boxes, implemented: true, permission: 'inventory:read' },
      {
        key: 'pools',
        label: 'Resource pools',
        route: '#/pools',
        icon: Layers,
        implemented: true,
        permission: 'inventory:read',
      },
      {
        key: 'providers',
        label: 'Providers',
        route: '#/providers',
        icon: Server,
        implemented: true,
        permission: 'inventory:read',
      },
      {
        key: 'reservations',
        label: 'Holds & reservations',
        route: '#/reservations',
        icon: CalendarClock,
        implemented: true,
        permission: 'reservations:read',
      },
      {
        key: 'allocation',
        label: 'Dispatch',
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
        key: 'policies',
        label: 'Policies',
        route: '#/policies',
        icon: Sliders,
        implemented: true,
        permission: 'policies:read',
      },
      {
        key: 'usage',
        label: 'Usage & capacity',
        route: '#/usage',
        icon: BarChart3,
        implemented: true,
        /* either ledger or meter rollups */
        permission: 'reports:read',
        altPermission: 'metering:read',
      },
      { key: 'audit', label: 'Audit & evidence', route: '#/audit', icon: FileSearch, implemented: true, permission: 'approvals:read' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      {
        key: 'access',
        label: 'Administration',
        route: '#/admin/access',
        icon: Shield,
        implemented: true,
        permission: 'users:read',
      },
      {
        key: 'admin-users',
        label: 'Users',
        route: '#/admin/users',
        icon: Users,
        implemented: true,
        permission: 'users:read',
      },
    ],
  },
];

/** Hidden routes still reachable (aliases / deep links) — not listed in sidebar. */
export const QRP_HIDDEN_ROUTES = {
  capacity: '#/capacity',
  connectors: '#/connectors',
};

export function filterNavGroups(groups, permissions = []) {
  const set = new Set(permissions);
  const has = (perm) => !perm || set.has(perm) || set.has('platform:manage');
  const hasItem = (item) => has(item.permission) || (item.altPermission && has(item.altPermission));
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => hasItem(item)),
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
  /* Schedule-hold alias → same page as reservations */
  if (path === '/schedule/hold' || path === '/holds') return { key: 'reservations', reviewId: null };
  if (path === '/schedule/admin') return { key: 'scheduling-admin', reviewId: null };
  const staticRoutes = ['pools', 'policies', 'capacity', 'usage', 'allocation', 'connectors', 'quotas', 'reservations'];
  for (const r of staticRoutes) {
    if (path === `/${r}`) return { key: r === 'quotas' ? 'usage' : r, reviewId: null };
  }
  if (path === '/admin/access') return { key: 'access', reviewId: null };
  if (path === '/admin/users') return { key: 'admin-users', reviewId: null };
  if (path === '/admin/platform') return { key: 'platform', reviewId: null };
  if (path === '/403') return { key: 'forbidden', reviewId: null };
  return { key: 'unknown', unknown: true, reviewId: null, assetId: null };
}