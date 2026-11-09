import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, User, Bell, Sparkles, Sun, Moon, Monitor } from 'lucide-react';
import { api } from '../services/api';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { formatIST } from '../utils/time';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { useTheme } from '../components/ui/ThemeProvider';
import { writeDensity } from '../utils/uiPreferences.js';
import { listPermissionsForRole, roleLabel } from '../lib/permissions.js';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import './UserSettings.css';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', hint: 'Bright workspace', icon: Sun },
  { id: 'dark', label: 'Dark', hint: 'Low-light labs', icon: Moon },
  { id: 'system', label: 'System', hint: 'Match device', icon: Monitor },
];

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Sparkles },
];

function initials(name, username) {
  const parts = String(name || username || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return String(username || 'U').slice(0, 2).toUpperCase();
}

export function UserSettings({ currentUser, onUserUpdate }) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [prefs, setPrefs] = useState({});
  const [mfa, setMfa] = useState({ enabled: false });
  const [enroll, setEnroll] = useState(null);
  const [otp, setOtp] = useState('');
  const [backups, setBackups] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionConfirm, setSessionConfirm] = useState(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, p, m, sess] = await Promise.all([
        api.getUserProfile(),
        api.getUserPreferences().catch(() => ({})),
        api.getMfaStatus().catch(() => ({ enabled: false })),
        api.getMySessions().catch(() => ({ sessions: [] })),
      ]);
      setProfile(me);
      setPrefs(p || {});
      if (p?.theme) setTheme(p.theme);
      setMfa(m || { enabled: false });
      setSessions(sess?.sessions || []);
    } catch (e) {
      notifyError(e?.message || 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const avatar = useMemo(
    () => initials(profile?.full_name, profile?.username),
    [profile?.full_name, profile?.username],
  );

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.patchUserProfile({
        full_name: profile.full_name,
        email: profile.email,
        org: profile.org,
        designation: profile.designation,
      });
      setProfile(updated);
      onUserUpdate?.({ ...currentUser, full_name: updated.full_name, email: updated.email, org: updated.org });
      notifySuccess('Profile saved.');
    } catch (e) {
      notifyError(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      const payload = { ...prefs, theme: theme || prefs.theme };
      const p = await api.patchUserPreferences(payload);
      setPrefs(p);
      if (p.display_density) writeDensity(p.display_density);
      if (p.theme) setTheme(p.theme);
      notifySuccess('Preferences saved.');
    } catch (e) {
      notifyError(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const pickTheme = (id) => {
    setTheme(id);
    setPrefs((prev) => ({ ...prev, theme: id }));
  };

  const startMfa = async () => {
    try {
      const r = await api.startMfaEnroll();
      setEnroll(r);
      setBackups(null);
    } catch (e) {
      notifyError(e?.message || 'MFA enroll failed.');
    }
  };

  const confirmMfa = async () => {
    try {
      const r = await api.confirmMfaEnroll(otp);
      setMfa({ enabled: true });
      setBackups(r.backup_codes || []);
      setEnroll(null);
      setOtp('');
      notifySuccess('Two-factor authentication enabled.');
    } catch (e) {
      notifyError(e?.message || 'Invalid code.');
    }
  };

  const disableMfa = async () => {
    try {
      await api.disableMfa(otp);
      setMfa({ enabled: false });
      setOtp('');
      notifySuccess('Two-factor authentication disabled.');
    } catch (e) {
      notifyError(e?.message || 'Could not disable MFA.');
    }
  };

  const effectivePerms = useMemo(() => {
    if (!profile) return [];
    if (profile.permissions?.length) return profile.permissions;
    if (currentUser?.permissions?.length) return currentUser.permissions;
    return listPermissionsForRole(profile.role || currentUser?.role);
  }, [profile, currentUser]);

  const permPreview = effectivePerms.slice(0, 10);

  if (loading || !profile) return <BoneyardSkeleton layout="settings" />;

  return (
    <div className="page-stack us-page">
      <div className="us-shell">
        <aside className="us-sidebar">
          <div className="us-identity">
            <div className="us-avatar" aria-hidden>{avatar}</div>
            <h2 className="us-identity__name">{profile.full_name || profile.username}</h2>
            <p className="us-identity__meta">@{profile.username}</p>
            <p className="us-identity__meta">{profile.email || 'Add email in profile'}</p>
            <span className="us-role">{profile.role_label || roleLabel(profile.role) || profile.role}</span>
            {permPreview.length > 0 && (
              <div className="us-perms" title="Effective capabilities for your role">
                {permPreview.map((p) => <span key={p}>{p}</span>)}
                {effectivePerms.length > permPreview.length && (
                  <span className="us-perms__more">+{effectivePerms.length - permPreview.length} more</span>
                )}
              </div>
            )}
          </div>
          <nav className="us-nav" aria-label="Settings sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`us-nav__btn${tab === id ? ' is-active' : ''}`}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="us-main">
      {tab === 'profile' && (
        <section className="us-card">
          <header className="us-card__head">
            <h3 className="us-card__title">Profile</h3>
            <p className="us-card__desc">Name and contact shown in acknowledgements, comments, and audit trails.</p>
          </header>
          <div className="us-grid">
            <div className="us-field">
              <label>Full name
                <input value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </label>
            </div>
            <div className="us-field">
              <label>Email
                <input type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="you@lab.org" />
              </label>
            </div>
            <div className="us-field">
              <label>Organization
                <input value={profile.org || ''} onChange={(e) => setProfile({ ...profile, org: e.target.value })} placeholder="C-DAC, IBM Quantum, …" />
              </label>
            </div>
            <div className="us-field">
              <label>Designation
                <input value={profile.designation || ''} onChange={(e) => setProfile({ ...profile, designation: e.target.value })} placeholder="Operations engineer" />
              </label>
            </div>
          </div>
          <div className="us-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={saveProfile}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </section>
      )}

      {tab === 'security' && (
        <>
        <section className="us-card">
          <header className="us-card__head">
            <h3 className="us-card__title">Change password</h3>
            <p className="us-card__desc">Other sessions are signed out after a successful change.</p>
          </header>
          <div className="us-grid">
            <div className="us-field">
              <label>Current password
                <input type="password" autoComplete="current-password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
              </label>
            </div>
            <div className="us-field">
              <label>New password
                <input type="password" autoComplete="new-password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
              </label>
            </div>
            <div className="us-field">
              <label>Confirm new password
                <input type="password" autoComplete="new-password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="us-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pwBusy}
              onClick={async () => {
                setPwBusy(true);
                try {
                  await api.changePassword({
                    current_password: pwCurrent,
                    new_password: pwNew,
                    confirm_password: pwConfirm,
                  });
                  setPwCurrent('');
                  setPwNew('');
                  setPwConfirm('');
                  notifySuccess('Password updated.');
                } catch (e) {
                  notifyError(e?.message || 'Password change failed.');
                } finally {
                  setPwBusy(false);
                }
              }}
            >
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </section>
        <section className="us-card">
          <header className="us-card__head">
            <h3 className="us-card__title">
              Two-factor authentication
              <InfoTooltip label="Two-factor authentication">
                Uses a TOTP app (Authenticator, Aegis). After enable, sign-in asks for a 6-digit code. This is not SMS. LDAP users can still enroll TOTP on this account name.
              </InfoTooltip>
            </h3>
            <p className="us-card__desc">TOTP authenticator app. Not SMS or email OTP.</p>
          </header>
          {!mfa.enabled && !enroll && (
            <button type="button" className="btn btn-primary" onClick={startMfa}>Enable 2FA</button>
          )}
          {enroll && (
            <div className="us-mfa-box">
              <p>Scan or enter this secret in your authenticator:</p>
              <p className="us-secret">{enroll.secret}</p>
              <p className="page-hint">{enroll.otpauth_url}</p>
              <div className="us-field">
                <label>Verification code
                  <input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" />
                </label>
              </div>
              <button type="button" className="btn btn-primary" onClick={confirmMfa}>Confirm & enable</button>
            </div>
          )}
          {backups && (
            <div className="us-mfa-box">
              <p><strong>Save these recovery codes once.</strong> They will not be shown again.</p>
              <div className="us-backups">{backups.map((c) => <code key={c}>{c}</code>)}</div>
            </div>
          )}
          {mfa.enabled && (
            <div className="us-mfa-box">
              <p>2FA is <strong>enabled</strong>{mfa.enrolled_at ? ` since ${mfa.enrolled_at}` : ''}.</p>
              <div className="us-field">
                <label>Code to disable
                  <input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} />
                </label>
              </div>
              <button type="button" className="btn btn-secondary" onClick={disableMfa}>Disable 2FA</button>
            </div>
          )}

        </section>
        <section className="us-card" data-tour="page-settings-sessions">
          <header className="us-card__head">
            <h3 className="us-card__title">Active sessions</h3>
            <p className="us-card__desc">Signed-in browsers and clients. Revoke sessions you do not recognize.</p>
          </header>
          {sessions.length === 0 ? (
            <p className="page-hint">No session list (sign in with bearer token to track sessions).</p>
          ) : (
            <>
              <ul className="us-sessions">
                {sessions.map((s) => (
                  <li key={s.session_id} className={s.current ? 'is-current' : ''}>
                    <div>
                      <strong>{s.current ? 'This device' : 'Other session'}</strong>
                      <span className="page-hint"> · {s.role || profile?.role}</span>
                    </div>
                    <div className="page-hint">
                      Started {formatIST(new Date((s.created_at || 0) * 1000).toISOString())}
                      {' · '}
                      Expires {formatIST(new Date((s.expires_at || 0) * 1000).toISOString())}
                    </div>
                    {!s.current && (
                      <button
                        type="button"
                        className="btn btn-secondary btn--xs"
                        disabled={sessionsBusy}
                        onClick={() => setSessionConfirm({ type: 'one', sessionId: s.session_id })}
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {sessions.some((s) => !s.current) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={sessionsBusy}
                  onClick={() => setSessionConfirm({ type: 'all' })}
                >
                  Sign out all other sessions
                </button>
              )}
            </>
          )}
        </section>
        </>
      )}

      {tab === 'notifications' && (
        <section className="us-card">
          <header className="us-card__head">
            <h3 className="us-card__title">Notifications</h3>
            <p className="us-card__desc">In-app notification preferences (email when outbound mail is configured).</p>
          </header>
          {[
            ['notify_critical', 'Critical alerts', 'QPU threshold breaches and fleet-critical events.'],
            ['notify_warning', 'Warning alerts', 'Degraded qubits and calibration aging.'],
            ['notify_incidents', 'Incidents', 'Assignment, status changes, and escalation.'],
            ['notify_comments', 'Comments', 'Thread replies and investigation notes.'],
          ].map(([key, label, hint]) => (
            <label key={key} className="us-check-row">
              <input
                type="checkbox"
                checked={prefs[key] !== false}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
              />
              <div>
                <strong>{label}</strong>
                <p>{hint}</p>
              </div>
            </label>
          ))}
          <div className="us-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={savePrefs}>Save notifications</button>
          </div>
        </section>
      )}

      {tab === 'preferences' && (
        <>
        <section className="us-card">
          <header className="us-card__head">
            <h3 className="us-card__title">Appearance</h3>
            <p className="us-card__desc">Console theme. Accessibility (font scale, motion) stays in the header accessibility panel.</p>
          </header>
          <div className="us-theme-grid">
            {THEME_OPTIONS.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`us-theme-tile${(theme || prefs.theme || 'light') === id ? ' is-active' : ''}`}
                onClick={() => pickTheme(id)}
              >
                <strong><Icon size={14} style={{ verticalAlign: -2, marginRight: 6 }} aria-hidden />{label}</strong>
                <span>{hint}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="us-card">
          <header className="us-card__head">
            <h3 className="us-card__title">Workspace defaults</h3>
            <p className="us-card__desc">Time zone, density, and where you land after sign-in.</p>
          </header>
          <div className="us-grid">
            <div className="us-field">
              <label>Time zone
                <input value={prefs.timezone || 'Asia/Kolkata'} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })} />
              </label>
            </div>
            <div className="us-field">
              <label>Date format
                <select className="input-control" value={prefs.date_format || 'ist'} onChange={(e) => setPrefs({ ...prefs, date_format: e.target.value })}>
                  <option value="ist">IST (en-IN)</option>
                  <option value="iso">ISO 8601</option>
                </select>
              </label>
            </div>
            <div className="us-field">
              <label>Display density
                <select className="input-control" value={prefs.display_density || 'comfortable'} onChange={(e) => setPrefs({ ...prefs, display_density: e.target.value })}>
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>
            <div className="us-field">
              <label>Default landing page
                <select className="input-control" value={prefs.landing_page || 'overview'} onChange={(e) => setPrefs({ ...prefs, landing_page: e.target.value })}>
                  <option value="overview">Fleet overview</option>
                  <option value="alerts">Alerts</option>
                  <option value="operations">Operator console</option>
                </select>
              </label>
            </div>
            <div className="us-field">
              <label>Alerts workspace tab
                <select className="input-control" value={prefs.default_alerts_view || 'alerts'} onChange={(e) => setPrefs({ ...prefs, default_alerts_view: e.target.value })}>
                  <option value="alerts">Active alerts</option>
                  <option value="incidents">Incidents</option>
                </select>
              </label>
            </div>
          </div>
          <div className="us-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={savePrefs}>Save preferences</button>
          </div>
        </section>
        </>
      )}
        </div>
      </div>
      {sessionConfirm?.type === 'one' && (
        <ConfirmDialog
          danger
          busy={sessionsBusy}
          dlg={{
            title: 'Revoke this session?',
            body: 'That device will be signed out immediately and must sign in again.',
            confirm: 'Yes, revoke',
            onConfirm: async () => {
              setSessionsBusy(true);
              try {
                await api.revokeSession(sessionConfirm.sessionId);
                notifySuccess('Session revoked.');
                setSessionConfirm(null);
                await load();
              } catch (e) {
                notifyError(e?.message || 'Revoke failed.');
              } finally {
                setSessionsBusy(false);
              }
            },
          }}
          onCancel={() => !sessionsBusy && setSessionConfirm(null)}
        />
      )}
      {sessionConfirm?.type === 'all' && (
        <ConfirmDialog
          danger
          busy={sessionsBusy}
          dlg={{
            title: 'Sign out all other sessions?',
            body: 'Every other browser or client using your account will lose access. This device stays signed in.',
            confirm: 'Yes, sign them out',
            onConfirm: async () => {
              setSessionsBusy(true);
              try {
                const res = await api.revokeOtherSessions();
                notifySuccess(`Revoked ${res.revoked || 0} other session(s).`);
                setSessionConfirm(null);
                await load();
              } catch (e) {
                notifyError(e?.message || 'Revoke failed.');
              } finally {
                setSessionsBusy(false);
              }
            },
          }}
          onCancel={() => !sessionsBusy && setSessionConfirm(null)}
        />
      )}
    </div>
  );
}
