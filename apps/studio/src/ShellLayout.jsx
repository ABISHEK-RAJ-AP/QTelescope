import { Home, FolderOpen, Sparkles } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthGate from '@qre-theme/AuthGate.jsx';

function RedirectToLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}
import Breadcrumbs from '@qre-theme/Breadcrumbs.jsx';
import StudioShell from '@qre-theme/StudioShell.jsx';
import SessionBar from '@qre-theme/SessionBar.jsx';

export default function ShellLayout({ title, children, breadcrumbs = null, contextBar = null }) {
  const loc = useLocation();
  const onProject = loc.pathname.startsWith('/project/');

  const navItems = [
    {
      key: 'landing',
      label: 'Product tour',
      to: '/landing',
      icon: Sparkles,
      active: loc.pathname === '/landing',
    },
    {
      key: 'projects',
      label: 'Projects',
      to: '/',
      icon: Home,
      active: loc.pathname === '/' || loc.pathname === '',
    },
    ...(onProject
      ? [
          {
            key: 'workspace',
            label: 'Current project',
            to: loc.pathname,
            icon: FolderOpen,
            active: true,
          },
        ]
      : []),
  ];

  return (
    <AuthGate appName="Q-Forge" variant="full" LoginPage={RedirectToLogin}>
      <StudioShell
        workspaceId="build"
        brandTitle="Q-Forge"
        productSubtitle="Development studio · compile & submit"
        title={title}
        navItems={navItems}
        topbarExtra={<SessionBar />}
        useGlobalHeader
        breadcrumbs={breadcrumbs}
        contextBar={contextBar}
      >
        {children}
      </StudioShell>
    </AuthGate>
  );
}

export function BackLink({ to = '/', children = '← Projects' }) {
  return (
    <Link to={to} className="qre-back-link">
      {children}
    </Link>
  );
}

export function buildBreadcrumbs(projectName) {
  const openHome = (e) => {
    e.preventDefault();
    window.location.href = '/build/';
  };
  const items = [{ label: 'Q-Forge', href: '/build/', onClick: openHome }];
  if (projectName) items.push({ label: projectName });
  return <Breadcrumbs items={items} />;
}
