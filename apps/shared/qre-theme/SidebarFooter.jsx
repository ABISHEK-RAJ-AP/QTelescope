import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { clearSession, fetchAuthMe, readSessionUser } from './auth.js';
import { buildUrl, governUrl, observeUrl, redirectToAppLogin } from './platformUrls.js';

function initials(me) {
  const n = me?.full_name || me?.username || me?.email || '?';
  const parts = String(n).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(n).slice(0, 2).toUpperCase();
}

export default function SidebarFooter({ allowDevRole = false, collapsed = false, showObserveLink = true }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [devRole, setDevRole] = useState(() => localStorage.getItem('qre_role') || 'Researcher');
  const hasToken = !!readSessionUser()?.token;

  function refresh() {
    setLoading(true);
    fetchAuthMe()
      .then((body) => setMe(body?.authenticated || body?.dev_session ? body : null))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    const onRole = () => refresh();
    window.addEventListener('qre-role-changed', onRole);
    window.addEventListener('storage', onRole);
    return () => {
      window.removeEventListener('qre-role-changed', onRole);
      window.removeEventListener('storage', onRole);
    };
  }, []);

  function logout() {
    clearSession();
    sessionStorage.removeItem('qre_govern_dev');
    const port = window.location.port;
    const path = window.location.pathname || '';
    if (port === '5175' || path.includes('/govern')) {
      window.location.href = governUrl('/govern/');
      return;
    }
    if (port === '5174' || path.includes('/build')) {
      window.location.href = buildUrl('/build/login');
      return;
    }
    window.location.href = observeUrl('/login');
  }

  if (loading) {
    return (
      <div className="qre-sidebar__footer">
        {!collapsed && <span className="qre-sidebar__footer-muted">Session…</span>}
      </div>
    );
  }

  const devLocal = allowDevRole && me?.dev_session && !hasToken;

  if (devLocal) {
    return (
      <div className="qre-sidebar__footer">
        {!collapsed && (
          <div className="qre-user-chip">
            <span className="qre-user-chip__avatar" aria-hidden>
              {devRole.slice(0, 2).toUpperCase()}
            </span>
            <div className="qre-user-chip__meta">
              <span className="qre-user-chip__name">Dev session</span>
              <span className="qre-user-chip__role">{devRole}</span>
            </div>
          </div>
        )}
        <div className="qre-sidebar__footer-actions qre-sidebar__footer-actions--stack">
          <button type="button" className="qre-btn qre-btn--ghost qre-sidebar__footer-cta" onClick={redirectToAppLogin}>
            Sign in to this app
          </button>
          <button
            type="button"
            className="qre-sidebar__footer-link"
            style={{ background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => {
              sessionStorage.removeItem('qre_govern_dev');
              localStorage.removeItem('qre_role');
              localStorage.removeItem('qre_user');
              window.location.reload();
            }}
          >
            Leave dev session
          </button>
        </div>
      </div>
    );
  }

  if (me?.authenticated) {
    return (
      <div className="qre-sidebar__footer">
        {!collapsed && (
        <div className="qre-user-chip">
          <span className="qre-user-chip__avatar" aria-hidden>
            {initials(me)}
          </span>
          <div className="qre-user-chip__meta">
            <span className="qre-user-chip__name">{me.full_name || me.username}</span>
            <span className="qre-user-chip__role">{me.role_label || me.role}</span>
          </div>
        </div>
        )}
        <div className="qre-sidebar__footer-actions">
          {showObserveLink && !collapsed ? (
            <a className="qre-sidebar__footer-link" href={observeUrl('/app/overview')}>
              Open Q-TeleScope
            </a>
          ) : null}
          <button type="button" className="qre-sidebar__footer-btn" onClick={logout} title="Sign out">
            <LogOut size={14} aria-hidden />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="qre-sidebar__footer">
      {!collapsed && <p className="qre-sidebar__footer-muted">Session required. Reload if you were signed out.</p>}
      <button type="button" className="qre-btn qre-btn--primary qre-sidebar__footer-cta" onClick={redirectToAppLogin}>
        {!collapsed && 'Sign in'}
      </button>
    </div>
  );
}
