import { useEffect, useMemo, useState } from 'react';
import { LoadingPanel } from './components/ui.jsx';
import ToastHost from './components/ToastHost.jsx';
import GovernErrorBoundary from './components/GovernErrorBoundary.jsx';
import ErrorPage from './pages/ErrorPage.jsx';
import GovernSignIn from './pages/GovernSignIn.jsx';
import GovernLanding from './pages/GovernLanding.jsx';
import GovernRegister from './pages/GovernRegister.jsx';
import StudioShell from '@qre-theme/StudioShell.jsx';
import Overview from './pages/Overview.jsx';
import Queue from './pages/Queue.jsx';
import Review from './pages/Review.jsx';
import MyWork from './pages/MyWork.jsx';
import ModulePlaceholder from './pages/ModulePlaceholder.jsx';
import { Inventory, Providers } from './pages/Capacity.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import InventoryDetail from './pages/InventoryDetail.jsx';
import VirtualPools from './pages/VirtualPools.jsx';
import Allocation from './pages/Allocation.jsx';
import Policies from './pages/Policies.jsx';
import ProviderHealth from './pages/ProviderHealth.jsx';
import Administration from './pages/Administration.jsx';
import Audit from './pages/Audit.jsx';
import UsageMetering from './pages/UsageMetering.jsx';
import CapacityUtilization from './pages/CapacityUtilization.jsx';
import Reservations from './pages/Reservations.jsx';
import PageFrame from './components/PageFrame.jsx';
import GovernCommandPalette from './components/GovernCommandPalette.jsx';
import UiScaleControl from './components/UiScaleControl.jsx';
import SessionSecurityBanner from './components/SessionSecurityBanner.jsx';
import { QRP_NAV_GROUPS, filterNavGroups, matchGovernRoute } from './nav/qrpNav.js';
import { useGovernSession } from './hooks/useGovernSession.js';
import { readContextProjectId } from '@qre-theme/contextScope.js';
import { governanceSummaryPath } from './lib/approvalsQuery.js';
import { observeUrl } from '@qre-theme/platformUrls.js';
import { api } from './api.js';

function readHash() {
  const raw = window.location.hash || '#/';
  return raw.startsWith('#') ? raw : `#${raw}`;
}

const PLACEHOLDERS = {};

const ALLOW_DEV = import.meta.env.DEV && import.meta.env.VITE_QRE_DEV_HEADERS !== 'false';

export default function App() {
  const [hash, setHash] = useState(readHash);
  const [queueBadge, setQueueBadge] = useState(0);
  const { me, loading, permissions } = useGovernSession();

  const canEnterApp = !!me?.authenticated || (ALLOW_DEV && !!me?.dev_session);

  useEffect(() => {
    if (me?.authenticated) sessionStorage.removeItem('qre_govern_dev');
  }, [me?.authenticated]);

  useEffect(() => {
    const onHash = () => setHash(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function refreshQueueBadge() {
    api(governanceSummaryPath(readContextProjectId()))
      .then((s) => setQueueBadge(s.queue ?? 0))
      .catch(() => setQueueBadge(0));
  }

  useEffect(() => {
    if (!canEnterApp) return undefined;
    refreshQueueBadge();
    const onRefresh = () => refreshQueueBadge();
    window.addEventListener('qre-role-changed', onRefresh);
    window.addEventListener('qre-context-changed', onRefresh);
    return () => {
      window.removeEventListener('qre-role-changed', onRefresh);
      window.removeEventListener('qre-context-changed', onRefresh);
    };
  }, [canEnterApp]);

  useEffect(() => {
    if (!canEnterApp) return;
    const current = (window.location.hash || '#/').replace(/^#/, '').split('?')[0];
    if (current === '/sign-in' || current === '/register') {
      window.location.hash = '#/';
    }
  }, [canEnterApp, hash]);

  function open(next) {
    window.location.hash = next;
    setHash(next);
  }

  const path = hash.replace(/^#/, '').split('?')[0];
  const queueQuery = hash.includes('?') ? new URLSearchParams(hash.split('?')[1] || '') : null;
  const { key: routeKey, reviewId, assetId, projectId } = matchGovernRoute(path);

  const navGroups = useMemo(() => {
    const filtered = filterNavGroups(QRP_NAV_GROUPS, permissions);
    return filtered.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const active =
          item.key === routeKey
          || (item.key === 'approvals' && (path === '/queue' || reviewId));
        return {
          ...item,
          active,
          to: item.externalPath ? undefined : item.route,
          externalHref: item.externalPath ? observeUrl(item.externalPath) : undefined,
          onClick: item.externalPath || !item.route ? undefined : () => open(item.route),
        };
      }),
    }));
  }, [permissions, routeKey, path, reviewId]);

  const paletteCommands = useMemo(() => {
    const cmds = [];
    navGroups.forEach((g) => {
      g.items.forEach((item) => {
        if (!item.route || item.externalPath) return;
        cmds.push({
          id: item.key,
          label: item.label,
          group: g.label,
          route: item.route,
          onClick: () => open(item.route),
        });
      });
    });
    cmds.push({ id: 'refresh-queue', label: 'Refresh queue badge', group: 'Actions', run: () => refreshQueueBadge() });
    cmds.push({ id: 'theme', label: 'Cycle theme', group: 'Actions', run: () => document.querySelector('.qre-icon-btn')?.click() });
    cmds.push({ id: 'type', label: 'Cycle type size', group: 'Actions', run: () => document.querySelector('[aria-label^="Type size"]')?.click() });
    return cmds;
  }, [navGroups]);

  let title = 'Overview';
  let body = <Overview onOpen={open} role={me?.role} permissions={permissions} />;

  if (reviewId) {
    title = 'Approval detail';
    body = <Review workloadId={reviewId} onBack={open} onOpen={open} permissions={permissions} me={me} />;
  } else if (path === '/queue') {
    title = 'Approvals';
    body = <Queue onOpen={open} initialState={queueQuery?.get('state') || ''} />;
  } else if (path === '/my-work') {
    title = 'My work';
    body = <MyWork onOpen={open} />;
  } else if (assetId) {
    title = 'Resource detail';
    body = <InventoryDetail assetId={assetId} onBack={open} />;
  } else if (path === '/inventory') {
    title = 'Resource inventory';
    body = <Inventory onOpen={open} permissions={permissions} />;
  } else if (path === '/pools') {
    title = 'Virtual resource pools';
    body = <VirtualPools onOpen={open} />;
  } else if (path === '/providers') {
    title = 'Providers & facilities';
    body = <Providers onOpen={open} />;
  } else if (projectId) {
    title = 'Project detail';
    body = <ProjectDetail projectId={projectId} onBack={open} onOpen={open} permissions={permissions} />;
  } else if (path === '/projects') {
    title = 'Organizations & projects';
    body = <Projects onOpen={open} />;
  } else if (path === '/allocation') {
    title = 'Allocation & orchestration';
    body = <Allocation onOpen={open} permissions={permissions} />;
  } else if (path === '/policies') {
    title = 'Policies & entitlements';
    body = <Policies onOpen={open} />;
  } else if (path === '/connectors') {
    title = 'Provider health';
    body = <ProviderHealth onOpen={open} />;
  } else if (path === '/403') {
    title = 'Permission required';
    body = <ErrorPage kind="forbidden" path={path} onOpen={open} />;
  } else if (path === '/admin/access' || path === '/admin/platform') {
    const canAdmin = permissions.includes('users:read') || permissions.includes('platform:manage');
    title = canAdmin ? 'Administration' : 'Permission required';
    body = canAdmin ? <Administration onOpen={open} me={me} /> : <ErrorPage kind="forbidden" path={path} onOpen={open} />;
  } else if (path === '/audit') {
    title = 'Audit & evidence';
    body = <Audit permissions={permissions} onOpen={open} />;
  } else if (path === '/capacity') {
    title = 'Capacity & utilization';
    body = <CapacityUtilization onOpen={open} permissions={permissions} />;
  } else if (path === '/usage' || path === '/quotas') {
    title = 'Usage & metering';
    body = <UsageMetering onOpen={open} />;
  } else if (path === '/reservations') {
    title = 'Reservations';
    body = <Reservations onOpen={open} permissions={permissions} />;
  } else if (PLACEHOLDERS[routeKey]) {
    const p = PLACEHOLDERS[routeKey];
    title = p.title;
    body = <ModulePlaceholder {...p} />;
  } else if (routeKey === 'unknown' || (path !== '/' && path !== '')) {
    title = 'Page not found';
    body = <ErrorPage kind="notfound" path={path} onOpen={open} />;
  }

  if (loading) {
    return <LoadingPanel label="Checking session…" />;
  }

  if (!canEnterApp) {
    const publicPath = path === '' ? '/' : path;
    const goHome = () => open('#/');
    const goSignIn = () => open('#/sign-in');
    const goRegister = () => open('#/register');
    const footerNav = (href) => {
      if (href === '#/' || href === '#/') goHome();
      else if (href === '#/sign-in') goSignIn();
      else if (href.startsWith('#/')) open(href);
      else if (href.startsWith('#')) {
        goHome();
        requestAnimationFrame(() => document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }));
      }
    };
    if (publicPath === '/sign-in') {
      return (
        <GovernSignIn
          onHome={goHome}
          onSignIn={goSignIn}
          onRegister={goRegister}
          onFooterNavigate={footerNav}
          onDevContinue={() => {
            window.dispatchEvent(new CustomEvent('qre-role-changed'));
          }}
        />
      );
    }
    if (publicPath === '/register') {
      return (
        <GovernRegister
          onHome={goHome}
          onSignIn={goSignIn}
          onRegister={goRegister}
          onFooterNavigate={footerNav}
          onRegistered={() => {
            setTimeout(() => goSignIn(), 800);
          }}
        />
      );
    }
    return (
      <GovernLanding onHome={goHome} onSignIn={goSignIn} onRegister={goRegister} onFooterNavigate={footerNav} />
    );
  }

  return (
    <>
      <a className="qre-skip-link" href="#main-content">
        Skip to main content
      </a>
      <ToastHost />
      <GovernCommandPalette commands={paletteCommands} onNavigate={(route) => route && open(route)} />
      <StudioShell
      workspaceId="govern"
      brandTitle="Govern"
      title={title}
      productSubtitle="C-DAC quantum programmes"
      navGroups={navGroups}
      badges={{ queue: queueBadge }}
      headerVariant="slim"
      hideObserveLink
      useGlobalHeader={false}
      showPageTitle={false}
      topbarExtra={<UiScaleControl />}
    >
      <PageFrame>
        <SessionSecurityBanner me={me} />
        <div className="govern-canvas">
          <GovernErrorBoundary onOpen={open}>{body}</GovernErrorBoundary>
        </div>
      </PageFrame>
    </StudioShell>
    </>
  );
}
