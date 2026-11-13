/** Map shell state ↔ /app/* URLs for deep linking (IMP-P1). */

import { BACKEND_WORKSPACE_TABS } from './lib/investigationLinks.js';
import { EXECUTION_NAV, RESOURCES_NAV, TELEMETRY_NAV } from './appSidebarNav.js';

const DEFAULT_BACKEND = 'ibm_brisbane';

export function buildAppPath(state) {
  const {
    mainTopic = 'home',
    backendSubTab = 'inventory',
    telemetrySubTab = 'live',
    executionSubTab = 'jobs',
    resourceSubTab = 'health',
    alertsView = 'alerts',
    operationsSubTab = 'centre',
    investigateSubTab = 'timeline',
    adminSubTab = 'integrations',
    backendWorkspaceTab = 'overview',
    selectedBackendId = DEFAULT_BACKEND,
    selectedIncidentId = '',
    selectedAlertId = '',
  } = state;

  switch (mainTopic) {
    case 'home':
      return '/app/overview';
    case 'platform':
      return '/app/platform/health';
    case 'investigate':
      if (investigateSubTab === 'timeline') return '/app/investigate/timeline';
      return '/app/investigate/timeline';
    case 'operations':
      if (operationsSubTab === 'timeline') return '/app/investigate/timeline';
      return '/app/operate';
    case 'backends':
      if (backendSubTab === 'details') {
        const base = `/app/backends/details/${encodeURIComponent(selectedBackendId)}`;
        const tab = backendWorkspaceTab || 'overview';
        if (tab === 'overview' || !BACKEND_WORKSPACE_TABS.includes(tab)) return base;
        return `${base}/${tab}`;
      }
      return `/app/backends/${backendSubTab}`;
    case 'telemetry':
      return `/app/telemetry/${telemetrySubTab}`;
    case 'execution':
      return `/app/execution/${executionSubTab}`;
    case 'resources':
      if (resourceSubTab === 'metrics') {
        return '/app/telemetry/metrics';
      }
      return `/app/resources/${resourceSubTab}`;
    case 'alerts':
      if (selectedAlertId) {
        return `/app/alerts/detail/${encodeURIComponent(selectedAlertId)}`;
      }
      if (alertsView === 'incidents' && selectedIncidentId) {
        return `/app/alerts/incidents/${encodeURIComponent(selectedIncidentId)}`;
      }
      return alertsView === 'incidents' ? '/app/alerts/incidents' : '/app/alerts';
    case 'reports':
      return '/app/reports';
    case 'settings':
      return '/app/settings';
    case 'design':
      return '/app/design';
    case 'admin':
      if (adminSubTab === 'hub') return '/app/admin/integrations';
      if (adminSubTab === 'integrations') return '/app/admin/integrations';
      if (adminSubTab === 'rules') return '/app/admin/rules';
      if (adminSubTab === 'collectors') return '/app/admin/collectors';
      if (adminSubTab === 'users') return '/app/admin/users';
      if (adminSubTab === 'logs') return '/app/admin/logs';
      return '/app/admin/integrations';
    default:
      return '/app/overview';
  }
}

export function parseAppPath(pathname) {
  const rest = (pathname || '').replace(/^\/app\/?/, '');
  const parts = rest.split('/').filter(Boolean);

  const out = {
    mainTopic: 'home',
    backendSubTab: 'inventory',
    telemetrySubTab: 'live',
    executionSubTab: 'jobs',
    resourceSubTab: 'health',
    alertsView: 'alerts',
    operationsSubTab: 'centre',
    investigateSubTab: 'timeline',
    adminSubTab: 'integrations',
    backendWorkspaceTab: 'overview',
    selectedBackendId: DEFAULT_BACKEND,
    selectedIncidentId: '',
    selectedAlertId: '',
  };

  if (parts.length === 0) return out;

  const [head, sub, third] = parts;

  if (head === 'design') {
    out.mainTopic = 'design';
    return out;
  }

  if (head === 'onboarding') {
    out.mainTopic = 'onboarding';
    return out;
  }

  if (head === 'overview') {
    out.mainTopic = 'home';
    return out;
  }
  if (head === 'operate') {
    out.mainTopic = 'operations';
    out.operationsSubTab = 'centre';
    return out;
  }
  if (head === 'platform') {
    out.mainTopic = 'platform';
    return out;
  }
  if (head === 'investigate') {
    out.mainTopic = 'investigate';
    if (sub === 'timeline') out.investigateSubTab = 'timeline';
    return out;
  }
  if (head === 'operations') {
    if (sub === 'health') {
      out.mainTopic = 'platform';
      return out;
    }
    if (sub === 'timeline') {
      out.mainTopic = 'investigate';
      out.investigateSubTab = 'timeline';
      return out;
    }
    out.mainTopic = 'operations';
    out.operationsSubTab = 'centre';
    return out;
  }
  if (head === 'reports') {
    out.mainTopic = 'reports';
    return out;
  }
  if (head === 'settings') {
    out.mainTopic = 'settings';
    return out;
  }
  if (head === 'admin') {
    out.mainTopic = 'admin';
    if (sub === 'integrations') out.adminSubTab = 'integrations';
    else if (sub === 'rules') out.adminSubTab = 'rules';
    else if (sub === 'collectors') out.adminSubTab = 'collectors';
    else if (sub === 'users') out.adminSubTab = 'users';
    else if (sub === 'logs') out.adminSubTab = 'logs';
    else out.adminSubTab = 'integrations';
    return out;
  }
  if (head === 'alerts') {
    out.mainTopic = 'alerts';
    if (sub === 'detail' && third) {
      out.alertsView = 'alerts';
      out.selectedAlertId = decodeURIComponent(third);
    } else if (sub === 'incidents') {
      out.alertsView = 'incidents';
      if (third) out.selectedIncidentId = decodeURIComponent(third);
    } else {
      out.alertsView = 'alerts';
    }
    return out;
  }
  if (head === 'backends') {
    out.mainTopic = 'backends';
    if (sub === 'details' && third) {
      out.backendSubTab = 'details';
      out.selectedBackendId = decodeURIComponent(third);
      const tab = parts[3];
      out.backendWorkspaceTab = tab && BACKEND_WORKSPACE_TABS.includes(tab) ? tab : 'overview';
    } else if (sub === 'qubits' || sub === 'inventory') {
      out.backendSubTab = 'inventory';
    }
    return out;
  }
  if (head === 'telemetry') {
    out.mainTopic = 'telemetry';
    const allowed = TELEMETRY_NAV.map((t) => t.value);
    if (sub && allowed.includes(sub)) out.telemetrySubTab = sub;
    return out;
  }
  if (head === 'execution') {
    out.mainTopic = 'execution';
    const exec = EXECUTION_NAV.map((t) => t.value);
    if (sub && exec.includes(sub)) out.executionSubTab = sub;
    return out;
  }
  if (head === 'resources') {
    if (sub === 'metrics') {
      out.mainTopic = 'telemetry';
      out.telemetrySubTab = 'metrics';
      return out;
    }
    out.mainTopic = 'resources';
    const resourceValues = new Set(RESOURCES_NAV.map((t) => t.value));
    if (resourceValues.has(sub) || sub === 'qdmi') {
      // legacy /qdmi path → capabilities
      out.resourceSubTab = sub === 'qdmi' ? 'capabilities' : sub;
    }
    if (sub === 'alerts') {
      out.mainTopic = 'alerts';
      out.alertsView = 'alerts';
    }
    return out;
  }

  out.unmatched = true;
  return out;
}

/** True when pathname is a legacy alias that should redirect to buildAppPath canonical URL. */
export function isLegacyAppPath(pathname) {
  const raw = pathname || '';
  const p = raw.endsWith('/') && raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  if (p === '/app') return true;
  if (!p.startsWith('/app/')) return false;
  const parsed = parseAppPath(p);
  if (parsed.unmatched) return false;
  const canonical = buildAppPath(parsed);
  return p !== canonical;
}
