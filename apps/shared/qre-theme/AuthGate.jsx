import { useEffect, useState } from 'react';
import QrePublicShell from './QrePublicShell.jsx';
import QreInlineSignIn from './QreInlineSignIn.jsx';
import QreAuthHeroLayout from './QreAuthHeroLayout.jsx';
import DevHeaderContinue from './DevHeaderContinue.jsx';
import { fetchAuthMe } from './auth.js';

export default function AuthGate({ appName, children, variant = 'embedded', LoginPage = null }) {
  const [state, setState] = useState('loading');
  const [me, setMe] = useState(null);

  function reload() {
    setState('loading');
    fetchAuthMe()
      .then((body) => {
        if (body?.authenticated || body?.dev_session) {
          setMe(body);
          setState('ok');
          return;
        }
        setState('login');
      })
      .catch(() => setState('login'));
  }

  useEffect(() => {
    reload();
    window.addEventListener('qre-role-changed', reload);
    return () => window.removeEventListener('qre-role-changed', reload);
  }, []);

  if (state === 'loading') {
    if (LoginPage) {
      return (
        <div className="qre-auth-gate qre-auth-gate--public">
          <p className="qre-auth-gate__sub">Checking session…</p>
        </div>
      );
    }
    const loading = (
      <div className="qre-auth-gate">
        <p className="qre-auth-gate__sub">Checking session…</p>
      </div>
    );
    if (variant === 'full') {
      return <QrePublicShell brandTitle={appName}>{loading}</QrePublicShell>;
    }
    return loading;
  }

  if (state === 'login') {
    if (LoginPage) {
      return <LoginPage onSuccess={reload} />;
    }
    const card = (
      <QreAuthHeroLayout
        heroTitle="Q-Forge"
        pathBrand="Forge"
        pathTagline="Compile, simulate, and submit workloads"
        panelTitle={`Sign in to ${appName}`}
      >
        <QreInlineSignIn appName={appName} onSuccess={reload} devContinueSlot={<DevHeaderContinue />} />
      </QreAuthHeroLayout>
    );
    if (variant === 'full') {
      return (
        <QrePublicShell brandTitle={appName} workspaceId="build">
          {card}
        </QrePublicShell>
      );
    }
    return <div className="qre-auth-gate qre-auth-gate--public">{card}</div>;
  }

  return typeof children === 'function' ? children(me) : children;
}
