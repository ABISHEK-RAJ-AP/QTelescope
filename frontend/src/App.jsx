import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Cpu, Activity, CheckCircle2,
  FileText, Settings, LogOut, ShieldAlert, AlertTriangle, PlaySquare, Radar,
  Sun, Moon, ChevronLeft, ChevronRight, ChevronDown, Server, History,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { buildAppPath, parseAppPath, isLegacyAppPath } from './appNav.js';
import {
  EXECUTION_NAV,
  RESOURCES_NAV,
  navBranchActive,
  navChildActive,
  goStateForNavChild,
  defaultGoStateForBranch,
} from './appSidebarNav.js';
import {
  ALERTS_HUB_NAV,
  LABS_TELEMETRY_NAV,
  NAV_HELP_PRIMARY,
  navChildGoState,
  navChildIsActive,
  navBranchIsActive,
  defaultBranchGoState,
} from './appPrimaryNav.js';
import { buildDriftInvestigationLocation } from './lib/investigationLinks.js';
import { parseScopeSearch } from './lib/appScopeQuery.js';
import cdacLogo from './assets/cdaclogo.png';
import { LazyImage } from './components/ui/LazyImage.jsx';
import { IstClock } from './components/shell/IstClock.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import {
  DashboardHome, BackendInventory, BackendDetails, LiveTelemetry,
  CalibrationStatus, DriftAnalysis, HistoricalTrends, MetricsExplorer, TopologyExplorer, CalibrationTimeline,
  MetricsCoverage, BackendComparison, AnomalyMonitor, TemporalReplay, JobMonitoring,
  QueueMonitoring, ResourceHealth, EnvironmentPage, DeviceCapabilities, AlertsEvents, ReportsPage,
  AdministrationPage, OperationsCentre, PlatformHealth, OpsTimeline, OnboardingFlow, UserSettings,
  IncidentDetailPage,
  AlertDetailPage,
  DesignSystemGallery,
} from './appLazyPages.js';
import { BoneyardSkeleton } from './components/ui/Skeleton';
import { api } from './services/api';
import { useTheme } from './components/ui/ThemeProvider';
import { PageHeader } from './components/observability/PageHeader.jsx';
import { resolvePageContext } from './utils/pageContext.js';
import { PageActionsProvider, usePageActions } from './context/PageActionsContext.jsx';
import { AlertsSummaryProvider, useAlertsSummary } from './context/AlertsSummaryContext.jsx';
import { A11yPreheader } from './components/shell/A11yPreheader.jsx';
import { ProductTour } from './components/onboarding/ProductTour.jsx';
import { ConfirmDialog } from './components/observability/ConfirmDialog.jsx';
import { QtQuickActionDock } from './components/quick-actions/QtQuickActionDock.jsx';
import { OperatorNoticeBell } from './components/shell/OperatorNoticeBell.jsx';
import { readDensity } from './utils/uiPreferences.js';
import { OnScreenKeyboard } from './components/shell/OnScreenKeyboard.jsx';
import { ToastHost } from './components/ui/ToastHost.jsx';
import { filterConsoleTourSteps } from './lib/consoleTour.js';
import { consumeConsoleTourPending, shouldRunOnboarding } from './lib/onboardingState.js';
import { canManageFleet, canSeeNavItem, visibleAdminNav } from './lib/permissions.js';
import { clearSession } from './lib/sessionAuth.js';
import { useSessionGuard } from './hooks/useSessionGuard.js';
import { CommandPalette, useCommandPaletteShortcut } from './components/shell/CommandPalette.jsx';

const SIDEBAR_COLLAPSE_KEY = 'qtelescope_sidebar_collapsed';

function initialsFor(user) {
  const n = user?.full_name || user?.username || '?';
  const parts = String(n).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(n).slice(0, 2).toUpperCase();
}

function AppShell({ currentUser, onLogout, onUserUpdate }) {
  const { actions: pageActions } = usePageActions();
  const { resolved, setTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [hoverExpand, setHoverExpand] = useState(false);
  const [density, setDensity] = useState(readDensity);

  // Sidebar Head Topics
  const [mainTopic, setMainTopic] = useState('home');

  const { activeCount: activeAlertsCount, criticalCount: criticalAlertsCount } = useAlertsSummary();
  // Sub-view selectors for each Head Topic
  const [backendSubTab, setBackendSubTab] = useState('inventory');
  const [telemetrySubTab, setTelemetrySubTab] = useState('live');
  const [executionSubTab, setExecutionSubTab] = useState('jobs');
  const [resourceSubTab, setResourceSubTab] = useState('health');
  const [alertsView, setAlertsView] = useState('alerts');
  const [operationsSubTab, setOperationsSubTab] = useState('centre');
  const [investigateSubTab, setInvestigateSubTab] = useState('timeline');
  const [adminSubTab, setAdminSubTab] = useState('hub');
  const [backendWorkspaceTab, setBackendWorkspaceTab] = useState('overview');

  const [selectedBackendId, setSelectedBackendId] = useState('ibm_brisbane');
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [selectedAlertId, setSelectedAlertId] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const [productTourOpen, setProductTourOpen] = useState(false);
  const [logoutDlg, setLogoutDlg] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useCommandPaletteShortcut(() => setCommandOpen(true));
  const [expandedBranches, setExpandedBranches] = useState(
    () => new Set(['alerts', 'admin']),
  );
  const [labsOpen, setLabsOpen] = useState(false);
  const canConfigure = canManageFleet(currentUser);
  const tourSteps = useMemo(
    () => filterConsoleTourSteps(currentUser, canSeeNavItem),
    [currentUser],
  );

  const handleTourStep = useCallback((step) => {
    if (!step) return;
    if (step.branch) {
      setExpandedBranches((prev) => {
        if (prev.has(step.branch)) return prev;
        const next = new Set(prev);
        next.add(step.branch);
        return next;
      });
    }
    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('startTour') === '1') {
      setProductTourOpen(true);
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    if (consumeConsoleTourPending(currentUser?.username)) {
      setProductTourOpen(true);
    }
  }, [currentUser?.username]);

  const navStateRef = useRef({
    mainTopic,
    backendSubTab,
    telemetrySubTab,
    executionSubTab,
    resourceSubTab,
    alertsView,
    operationsSubTab,
    investigateSubTab,
    adminSubTab,
    backendWorkspaceTab,
    selectedBackendId,
    selectedIncidentId,
    selectedAlertId,
  });
  navStateRef.current = {
    mainTopic,
    backendSubTab,
    telemetrySubTab,
    executionSubTab,
    resourceSubTab,
    alertsView,
    operationsSubTab,
    investigateSubTab,
    adminSubTab,
    backendWorkspaceTab,
    selectedBackendId,
    selectedIncidentId,
    selectedAlertId,
  };

  useEffect(() => {
    const parsed = parseAppPath(location.pathname);
    setMainTopic(parsed.mainTopic);
    setBackendSubTab(parsed.backendSubTab);
    setTelemetrySubTab(parsed.telemetrySubTab);
    setExecutionSubTab(parsed.executionSubTab);
    setResourceSubTab(parsed.resourceSubTab);
    setAlertsView(parsed.alertsView);
    setOperationsSubTab(parsed.operationsSubTab);
    setInvestigateSubTab(parsed.investigateSubTab);
    setAdminSubTab(parsed.adminSubTab);
    setBackendWorkspaceTab(parsed.backendWorkspaceTab);
    setSelectedBackendId(parsed.selectedBackendId);
    setSelectedIncidentId(parsed.selectedIncidentId || '');
    setSelectedAlertId(parsed.selectedAlertId || '');
  }, [location.pathname]);

  /** Legacy aliases only — do not rewrite URL on every nav state tick (caused redirect flicker). */
  useEffect(() => {
    if (!isLegacyAppPath(location.pathname)) return;
    const canonical = buildAppPath(parseAppPath(location.pathname));
    if (location.pathname !== canonical) {
      navigate({ pathname: canonical, search: location.search }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const go = useCallback((patch) => {
    const next = { ...navStateRef.current, ...patch };
    const search = new URLSearchParams(location.search);
    if (patch.mainTopic && patch.mainTopic !== 'alerts') {
      search.delete('alert');
    }
    const onQueues = next.mainTopic === 'execution' && next.executionSubTab === 'queues';
    if (!onQueues) search.delete('queue');
    const q = search.toString();
    navigate({
      pathname: buildAppPath(next),
      search: q ? `?${q}` : '',
    });
  }, [navigate, location.search]);

  const onNavigateAlerts = useCallback(() => go({ mainTopic: 'alerts', alertsView: 'alerts' }), [go]);
  const onNavigateJobs = useCallback(() => go({ mainTopic: 'execution', executionSubTab: 'jobs' }), [go]);
  const onNavigateInventory = useCallback(() => go({ mainTopic: 'backends', backendSubTab: 'inventory' }), [go]);
  const onNavigateBackend = useCallback(
    (id) => go({ mainTopic: 'backends', backendSubTab: 'details', selectedBackendId: id }),
    [go],
  );
  const onNavigateOperations = useCallback(() => go({ mainTopic: 'operations', operationsSubTab: 'centre' }), [go]);
  const onNavigatePlatformHealth = useCallback(() => go({ mainTopic: 'platform' }), [go]);
  const onNavigateTimeline = useCallback(() => go({ mainTopic: 'investigate', investigateSubTab: 'timeline' }), [go]);
  const onNavigateCompare = useCallback(() => go({ mainTopic: 'telemetry', telemetrySubTab: 'compare' }), [go]);
  const onNavigateResourceHealth = useCallback(() => go({ mainTopic: 'resources', resourceSubTab: 'health' }), [go]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!collapsed && hoverExpand) setHoverExpand(false);
  }, [collapsed, hoverExpand]);

  useEffect(() => {
    if (['telemetry', 'execution', 'resources', 'alerts', 'admin'].includes(mainTopic)) {
      setExpandedBranches((prev) => new Set(prev).add(mainTopic));
    }
  }, [mainTopic]);

  const performLogout = async () => {
    setLogoutBusy(true);
    try {
      await api.logout();
    } catch {
      /* session may already be invalid */
    }
    clearSession();
    setLogoutDlg(false);
    onLogout?.();
    setLogoutBusy(false);
  };

  const tourSidebarOpen = productTourOpen;
  const effectiveCollapsed = collapsed && !hoverExpand && !tourSidebarOpen;

  const handleSelectBackend = (id) => {
    go({
      mainTopic: 'backends',
      backendSubTab: 'details',
      selectedBackendId: id,
      backendWorkspaceTab: 'overview',
    });
  };

  const openAlertInvestigation = (alert) => {
    const backendId = alert?.backend_id || '';
    const search = new URLSearchParams();
    if (backendId) search.set('backend', backendId);
    if (alert?.alert_id) search.set('alert', alert.alert_id);
    const q = search.toString();
    navigate({
      pathname: '/app/investigate/timeline',
      search: q ? `?${q}` : '',
    });
  };

  const openAlertDrift = (alert) => {
    const backendId = alert?.backend_id || '';
    if (!backendId) return;
    navigate(buildDriftInvestigationLocation({ backendId }));
  };

  const openBackendWorkspace = (backendId, tab = 'overview') => {
    go({
      mainTopic: 'backends',
      backendSubTab: 'details',
      selectedBackendId: backendId,
      backendWorkspaceTab: tab,
    });
  };

  // Render main topic view with internal sub-tabs
  const renderContent = () => {
    if (mainTopic !== 'settings' && mainTopic !== 'onboarding' && mainTopic !== 'design' && !canSeeNavItem(currentUser, mainTopic)) {
      return (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <ShieldAlert size={48} color="#e11d48" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access restricted</h2>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Role <strong>{currentUser?.role_label || currentUser?.role}</strong> cannot open this page.
          </p>
        </div>
      );
    }
    switch (mainTopic) {
      case 'design':
        return <DesignSystemGallery />;

      case 'home':
        return (
          <DashboardHome
            onNavigateAlerts={onNavigateAlerts}
            onNavigateJobs={onNavigateJobs}
            onNavigateInventory={onNavigateInventory}
            onNavigateBackend={onNavigateBackend}
            onNavigateOperations={onNavigateOperations}
            onNavigatePlatformHealth={onNavigatePlatformHealth}
            onNavigateTimeline={onNavigateTimeline}
            onNavigateCompare={onNavigateCompare}
            onNavigateResourceHealth={onNavigateResourceHealth}
          />
        );

      case 'operations':
        return (
          <OperationsCentre
            onOpenIncidents={() => go({ mainTopic: 'alerts', alertsView: 'incidents' })}
            onOpenAlerts={() => go({ mainTopic: 'alerts', alertsView: 'alerts' })}
            onOpenFleetInventory={() => go({ mainTopic: 'backends', backendSubTab: 'inventory' })}
            onInvestigateAlert={openAlertInvestigation}
          />
        );

      case 'platform':
        return <PlatformHealth />;

      case 'investigate':
        return investigateSubTab === 'timeline' ? <OpsTimeline /> : <OpsTimeline />;

      case 'backends':
        if (backendSubTab === 'details') {
          return (
            <BackendDetails
              backendId={selectedBackendId}
              workspaceTab={backendWorkspaceTab}
              onWorkspaceTabChange={(tab) => go({
                mainTopic: 'backends',
                backendSubTab: 'details',
                selectedBackendId,
                backendWorkspaceTab: tab,
              })}
              onBack={() => go({ mainTopic: 'backends', backendSubTab: 'inventory' })}
            />
          );
        }
        return (
          <BackendInventory
            onSelectBackend={handleSelectBackend}
            isAdmin={canConfigure}
          />
        );

      case 'telemetry':
        return (
          <>
            {telemetrySubTab === 'live' && <LiveTelemetry />}
            {telemetrySubTab === 'calibration' && <CalibrationStatus />}
            {telemetrySubTab === 'drift' && <DriftAnalysis />}
            {telemetrySubTab === 'trends' && <HistoricalTrends />}
            {telemetrySubTab === 'explorer' && <MetricsExplorer />}
            {telemetrySubTab === 'topology' && <TopologyExplorer />}
            {telemetrySubTab === 'cal-timeline' && <CalibrationTimeline />}
            {telemetrySubTab === 'compare' && <BackendComparison />}
            {telemetrySubTab === 'anomalies' && <AnomalyMonitor />}
            {telemetrySubTab === 'replay' && <TemporalReplay />}
            {telemetrySubTab === 'metrics' && <MetricsCoverage />}
          </>
        );

      case 'alerts':
        if (selectedAlertId) {
          return (
            <AlertDetailPage
              alertId={selectedAlertId}
              currentUser={currentUser}
              onBack={() => go({ mainTopic: 'alerts', alertsView: 'alerts', selectedAlertId: '' })}
              onOpenIncident={(id) => go({
                mainTopic: 'alerts',
                alertsView: 'incidents',
                selectedIncidentId: id,
                selectedAlertId: '',
              })}
              onInvestigateTimeline={openAlertInvestigation}
              onInvestigateDrift={openAlertDrift}
              onOpenBackend={(backendId) => openBackendWorkspace(backendId, 'qubits')}
            />
          );
        }
        if (selectedIncidentId) {
          return (
            <IncidentDetailPage
              incidentId={selectedIncidentId}
              currentUser={currentUser}
              onBack={() => go({ mainTopic: 'alerts', alertsView: 'incidents', selectedIncidentId: '' })}
              onOpenAlert={(id) => go({
                mainTopic: 'alerts',
                alertsView: 'alerts',
                selectedAlertId: id,
                selectedIncidentId: '',
              })}
            />
          );
        }
        return (
          <AlertsEvents
            view={alertsView}
            currentUser={currentUser}
            onOpenAlertWorkspace={(id) => go({ mainTopic: 'alerts', alertsView: 'alerts', selectedAlertId: id })}
            onOpenIncident={(id) => go({ mainTopic: 'alerts', alertsView: 'incidents', selectedIncidentId: id })}
            onViewChange={(view) => go({
              mainTopic: 'alerts',
              alertsView: view,
              selectedIncidentId: '',
              selectedAlertId: '',
            })}
            onInvestigateTimeline={openAlertInvestigation}
            onInvestigateDrift={openAlertDrift}
            onOpenBackend={(backendId) => openBackendWorkspace(backendId, 'qubits')}
          />
        );

      case 'settings':
        return (
          <UserSettings
            currentUser={currentUser}
            onUserUpdate={(next) => {
              try {
                localStorage.setItem('quantum_user', JSON.stringify(next));
              } catch { /* ignore */ }
              onUserUpdate?.(next);
            }}
          />
        );

      case 'execution':
        return executionSubTab === 'queues' ? (
          <QueueMonitoring onSelectBackend={(id) => openBackendWorkspace(id, 'execution')} />
        ) : (
          <JobMonitoring onOpenBackendWorkspace={(id) => openBackendWorkspace(id, 'execution')} />
        );

      case 'resources':
        if (resourceSubTab === 'environment') return <EnvironmentPage />;
        if (resourceSubTab === 'capabilities' || resourceSubTab === 'qdmi') return <DeviceCapabilities />;
        return <ResourceHealth />;

      case 'reports':
        return <ReportsPage />;

      case 'admin': {
        const adminChildren = visibleAdminNav(currentUser);
        if (!adminChildren.length || !adminChildren.some((c) => c.value === adminSubTab || adminSubTab === 'hub')) {
          return (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <ShieldAlert size={48} color="#e11d48" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: 20, color: '#e11d48', fontWeight: 700, marginBottom: 8 }}>
                Access Restricted
              </h2>
              <p style={{ color: '#64748b', fontSize: 14 }}>
                This configuration page is not available for role <strong>{currentUser?.role_label || currentUser?.role}</strong>.
              </p>
            </div>
          );
        }
        const section = adminChildren.some((c) => c.value === adminSubTab) ? adminSubTab : adminChildren[0].value;
        return (
          <AdministrationPage
            section={section}
            onNavigateSection={(next) => go({ mainTopic: 'admin', adminSubTab: next })}
          />
        );
      }

      default:
        return (
          <DashboardHome
            onNavigateAlerts={onNavigateAlerts}
            onNavigateJobs={onNavigateJobs}
            onNavigateInventory={onNavigateInventory}
            onNavigateBackend={onNavigateBackend}
            onNavigateOperations={onNavigateOperations}
            onNavigatePlatformHealth={onNavigatePlatformHealth}
            onNavigateTimeline={onNavigateTimeline}
            onNavigateCompare={onNavigateCompare}
            onNavigateResourceHealth={onNavigateResourceHealth}
          />
        );
    }
  };

  const pageContext = resolvePageContext({
    mainTopic,
    backendSubTab,
    telemetrySubTab,
    executionSubTab,
    resourceSubTab,
    alertsView,
    operationsSubTab,
    investigateSubTab,
    adminSubTab,
    backendWorkspaceTab,
    selectedBackendId,
    selectedIncidentId,
    selectedAlertId,
  });

  const headerBreadcrumbs = useMemo(() => {
    if (mainTopic === 'alerts' && selectedAlertId) {
      return [
        ...pageContext.breadcrumbs.slice(0, -1),
        { label: 'Active alerts', onClick: () => go({ mainTopic: 'alerts', alertsView: 'alerts', selectedAlertId: '' }) },
        { label: selectedAlertId },
      ];
    }
    if (mainTopic === 'alerts' && selectedIncidentId) {
      return [
        ...pageContext.breadcrumbs.slice(0, -1),
        { label: 'Incidents', onClick: () => go({ mainTopic: 'alerts', alertsView: 'incidents', selectedIncidentId: '' }) },
        { label: selectedIncidentId },
      ];
    }
    if (mainTopic !== 'backends') return pageContext.breadcrumbs;
    return pageContext.breadcrumbs.map((crumb) => {
      if (crumb.label === 'Backend library') {
        return { ...crumb, onClick: onNavigateInventory };
      }
      return crumb;
    });
  }, [mainTopic, pageContext.breadcrumbs, onNavigateInventory, selectedIncidentId, selectedAlertId, go]);

  const shellNavState = {
    mainTopic,
    telemetrySubTab,
    executionSubTab,
    resourceSubTab,
    alertsView,
    adminSubTab,
    selectedAlertId,
    selectedIncidentId,
  };

  const navGroups = useMemo(() => {
    const primary = {
      label: 'Console',
      items: [
        { id: 'home', label: 'Overview', icon: LayoutDashboard },
        { id: 'backends', label: 'Backends', icon: Cpu },
        {
          id: 'alerts',
          label: 'Alerts & incidents',
          icon: AlertTriangle,
          children: ALERTS_HUB_NAV,
          badge: criticalAlertsCount > 0 ? criticalAlertsCount : (activeAlertsCount > 0 ? activeAlertsCount : 0),
          badgeVariant: criticalAlertsCount > 0 ? 'critical' : 'total',
          badgeTitle: criticalAlertsCount > 0
            ? `${criticalAlertsCount} critical · ${activeAlertsCount} active`
            : `${activeAlertsCount} active alerts`,
        },
        { id: 'compare', label: 'Compare & routing', icon: Activity },
        { id: 'reports', label: 'Reports', icon: FileText },
      ].filter((item) => canSeeNavItem(currentUser, item.id)),
    };
    const labsItems = [
      { id: 'telemetry', label: 'Telemetry', icon: Activity, children: LABS_TELEMETRY_NAV },
      { id: 'execution', label: 'Execution', icon: PlaySquare, children: EXECUTION_NAV },
      { id: 'resources', label: 'Resources', icon: CheckCircle2, children: RESOURCES_NAV },
      { id: 'platform', label: 'Platform health', icon: Server },
      { id: 'operations', label: 'Operator console', icon: Radar },
      { id: 'investigate', label: 'Timeline', icon: History },
    ].filter((item) => canSeeNavItem(currentUser, item.id));
    const labs = labsItems.length
      ? { label: 'Labs', items: labsItems, labsGroup: true }
      : null;
    return [primary, labs].filter(Boolean).filter((g) => g.items.length > 0);
  }, [activeAlertsCount, criticalAlertsCount, currentUser]);

  const adminNav = visibleAdminNav(currentUser);
  const adminItem = adminNav.length
    ? { id: 'admin', label: 'Settings', icon: Settings, children: adminNav }
    : null;

  const toggleBranch = (id) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolveChildGo = (item, child) => (
    child.target ? navChildGoState(item.id, child) : goStateForNavChild(item, child)
  );
  const resolveChildActive = (item, child) => (
    child.target ? navChildIsActive(item.id, child, shellNavState) : navChildActive(item, child, shellNavState)
  );

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const hasChildren = !!item.children?.length;
    const branchActive = hasChildren && navBranchIsActive(item.id, shellNavState);
    const leafActive = !hasChildren && (
      item.id === 'compare'
        ? mainTopic === 'telemetry' && telemetrySubTab === 'compare'
        : mainTopic === item.id
    );
    const expanded = hasChildren && expandedBranches.has(item.id);

    if (effectiveCollapsed && hasChildren) {
      return (
        <button
          type="button"
          key={item.id}
          data-tour={`nav-${item.id}`}
          className={`nav-item ${branchActive ? 'active' : ''}`}
          title={NAV_HELP_PRIMARY[item.id] || item.label}
          onClick={() => go(defaultBranchGoState(item.id, item.children))}
        >
          <span className="nav-icon">
            <Icon size={18} color={item.id === 'alerts' && item.badge > 0 ? '#e11d48' : 'currentColor'} />
          </span>
        </button>
      );
    }

    return (
      <div key={item.id} className="nav-branch">
        <button
          type="button"
          data-tour={`nav-${item.id}`}
          className={`nav-item ${hasChildren ? 'nav-item--parent' : ''} ${leafActive || (hasChildren && branchActive && !expanded) ? 'active' : ''}`}
          onClick={() => {
            if (hasChildren) {
              if (!expanded) {
                setExpandedBranches((p) => new Set(p).add(item.id));
                go(defaultBranchGoState(item.id, item.children));
              } else {
                toggleBranch(item.id);
              }
            } else if (item.id === 'compare') {
              go({ mainTopic: 'telemetry', telemetrySubTab: 'compare' });
            } else {
              go({ mainTopic: item.id });
            }
          }}
          title={NAV_HELP_PRIMARY[item.id] || item.label}
        >
          <span className="nav-icon">
            <Icon size={18} color={item.id === 'alerts' && item.badge > 0 ? '#e11d48' : 'currentColor'} />
          </span>
          <span className={`nav-label${effectiveCollapsed ? ' nav-label--collapsed' : ''}`}>{item.label}</span>
          {hasChildren && !effectiveCollapsed && (
            <span className="nav-chevron" aria-hidden>
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          {!effectiveCollapsed && item.badge > 0 && (
            <span
              className={`sidebar-alert-badge${item.badgeVariant === 'critical' ? ' sidebar-alert-badge--critical' : ''}`}
              title={item.badgeTitle || `${item.badge} alerts`}
            >
              {item.badgeVariant === 'critical' ? `${item.badge} crit` : item.badge}
            </span>
          )}
        </button>
        {hasChildren && expanded && !effectiveCollapsed && (
          <div className="nav-sub-list" role="group" aria-label={`${item.label} pages`}>
            {item.children.map((child) => (
              <button
                type="button"
                key={child.value}
                className={`nav-sub-item ${resolveChildActive(item, child) ? 'active' : ''}`}
                onClick={() => go(resolveChildGo(item, child))}
              >
                {child.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const displayName = currentUser.full_name || currentUser.username;

  return (
    <>
    <div className="app-shell">
      <A11yPreheader />
    <div className="app-container">
      <aside
        className={`sidebar${collapsed && !tourSidebarOpen ? ' sidebar-collapsed' : ''}${hoverExpand && collapsed && !tourSidebarOpen ? ' sidebar-hover-expanded' : ''}`}
        onMouseEnter={() => { if (collapsed) setHoverExpand(true); }}
        onMouseLeave={() => setHoverExpand(false)}
        onFocusCapture={() => { if (collapsed) setHoverExpand(true); }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setHoverExpand(false);
        }}
      >
        <Link to="/" className="sidebar-header" title="Q-TeleScope home">
          <LazyImage src={cdacLogo} alt="C-DAC" className="sidebar-logo-img" />
          {!effectiveCollapsed && (
            <div>
              <div className="sidebar-title">Q-TeleScope</div>
              <div className="sidebar-subtitle">Quantum Platform</div>
            </div>
          )}
        </Link>

        <nav className="sidebar-nav" data-tour="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              {group.labsGroup && !effectiveCollapsed ? (
                <button
                  type="button"
                  className="nav-group-label nav-group-label--button"
                  aria-expanded={labsOpen}
                  onClick={() => setLabsOpen((v) => !v)}
                >
                  {group.label}
                  <ChevronDown size={14} style={{ transform: labsOpen ? 'rotate(0)' : 'rotate(-90deg)' }} aria-hidden />
                </button>
              ) : (!effectiveCollapsed && <div className="nav-group-label">{group.label}</div>)}
              {(group.labsGroup ? labsOpen : true) && group.items.map((item) => renderNavItem(item))}
            </div>
          ))}
          {adminItem && (
            <div key="admin">
              {!effectiveCollapsed && <div className="nav-group-label">Settings</div>}
              {renderNavItem(adminItem)}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="nav-item sidebar-collapse-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="nav-icon">
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </span>
            {!effectiveCollapsed && <span className="nav-label">Collapse</span>}
          </button>

          <button
            type="button"
            className="sidebar-footer__profile"
            title={`${displayName} — account settings`}
            onClick={() => go({ mainTopic: 'settings' })}
          >
            <div className="sidebar-footer__avatar">{initialsFor(currentUser)}</div>
            {!effectiveCollapsed && (
              <div className="sidebar-footer__meta">
                <div className="sidebar-footer__name">{displayName}</div>
                <div className="sidebar-footer__role">{currentUser.role_label || currentUser.role}</div>
              </div>
            )}
            {!effectiveCollapsed && (
              <span
                role="button"
                tabIndex={0}
                className="sidebar-footer__logout"
                onClick={(e) => { e.stopPropagation(); setLogoutDlg(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setLogoutDlg(true); } }}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} />
              </span>
            )}
          </button>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className={`main-content${collapsed ? ' main-content--collapsed' : ''}${hoverExpand && collapsed ? ' main-content--hover-expanded' : ''}`}
      >
        <header className="app-page-head">
          <PageHeader
            embedded
            breadcrumbs={headerBreadcrumbs}
            title={pageContext.title}
            description={pageContext.description}
            backendId={pageContext.backendId}
            actions={pageActions}
            trailing={(
              <div className="app-page-head__global">
                <OperatorNoticeBell />
                <IstClock />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
                  title={resolved === 'dark' ? 'Switch to light' : 'Switch to dark'}
                  aria-label="Toggle theme"
                >
                  {resolved === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              </div>
            )}
          />
        </header>

        <div id="page-content" tabIndex={-1} className={`page-container page-container--${density}`}>
          <Suspense fallback={<BoneyardSkeleton layout="dashboard" />}>
            {renderContent()}
          </Suspense>
        </div>
      </main>
    </div>
    </div>
    <ToastHost />
    <OnScreenKeyboard />
    <ProductTour
      open={productTourOpen}
      steps={tourSteps}
      onStep={handleTourStep}
      onClose={() => setProductTourOpen(false)}
    />
    <QtQuickActionDock
      currentUser={currentUser}
      onStartTour={() => setProductTourOpen(true)}
      activeAlertsCount={activeAlertsCount}
      criticalAlertsCount={criticalAlertsCount}
    />
    <CommandPalette
      open={commandOpen}
      onClose={() => setCommandOpen(false)}
      currentUser={currentUser}
      onStartTour={() => setProductTourOpen(true)}
    />
    {logoutDlg && (
      <ConfirmDialog
        danger
        busy={logoutBusy}
        dlg={{
          title: 'Sign out?',
          body: 'Your session on this device will end. Unsaved work in open forms may be lost.',
          confirm: 'Yes, sign out',
        }}
        onCancel={() => !logoutBusy && setLogoutDlg(false)}
        onConfirm={performLogout}
      />
    )}
    </>
  );
}

export const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('quantum_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (userObj) => {
    setCurrentUser(userObj);
  };

  const endSession = useCallback(() => setCurrentUser(null), []);
  const refreshSession = useCallback((user) => setCurrentUser(user), []);

  useSessionGuard(currentUser, { onEnd: endSession, onRefresh: refreshSession });

  useEffect(() => {
    if (!currentUser) return;
    if (
      shouldRunOnboarding(currentUser)
      && !location.pathname.startsWith('/app/onboarding')
    ) {
      navigate('/app/onboarding', { replace: true });
    }
  }, [currentUser, location.pathname, navigate]);

  if (!currentUser) {
    return (
      <>
        <ToastHost />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  if (location.pathname.startsWith('/app/onboarding')) {
    return (
      <>
        <ToastHost />
        <OnboardingFlow currentUser={currentUser} />
      </>
    );
  }

  return (
    <AlertsSummaryProvider>
      <PageActionsProvider>
        <AppShell currentUser={currentUser} onLogout={endSession} onUserUpdate={setCurrentUser} />
      </PageActionsProvider>
    </AlertsSummaryProvider>
  );
};

export default App;
