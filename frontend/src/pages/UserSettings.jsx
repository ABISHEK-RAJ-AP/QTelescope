import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accessibility, Bell, Monitor, Moon, Shield, SlidersHorizontal, Sun, User,
} from 'lucide-react';
import { api } from '../services/api';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { unableToLoad } from '../constants/messages.js';
import { formatIST } from '../utils/time';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { useTheme } from '../components/ui/ThemeProvider';
import { writeDensity } from '../utils/uiPreferences.js';
import { roleLabel } from '../lib/permissions.js';
import { Toggle } from '../components/ui/Toggle.jsx';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import { MfaTotpEnrollModal } from '../components/settings/MfaTotpEnrollModal.jsx';
import { SettingsPasswordField } from '../components/settings/SettingsPasswordField.jsx';
import { A11yPanel } from '../components/shell/A11yPanel.jsx';
import { loadA11yPrefs } from '../lib/accessibilityPrefs.js';
import { cacheWorkspacePrefs } from '../lib/userLandingPrefs.js';
import './UserSettings.css';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', hint: 'Light appearance', icon: Sun },
  { id: 'dark', label: 'Dark', hint: 'Dark appearance', icon: Moon },
  { id: 'system', label: 'System', hint: 'Follow system appearance', icon: Monitor },
];

const NAV_GROUPS = [
  {
    title: 'Account',
    items: [
      { id: 'profile', label: 'Personal information', icon: User },
      { id: 'security', label: 'Security', icon: Shield },
    ],
  },
  {
    title: 'Personalization',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'appearance', label: 'Appearance', icon: Sun },
      { id: 'workspace', label: 'Workspace', icon: SlidersHorizontal },
      { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    ],
  },
];

const NOTIFY_GROUPS = [
  {
    title: 'Critical & operational',
    rows: [
      ['notify_critical', 'Critical alerts', 'Critical quantum hardware and fleet health events.'],
      ['notify_warning', 'Warning alerts', 'Degraded qubits and calibration aging.'],
      ['notify_incidents', 'Incidents', 'Assignments, status changes, and escalations.'],
    ],
  },
  {
    title: 'Collaboration',
    rows: [
      ['notify_comments', 'Comments', 'Thread replies and investigation notes.'],
    ],
  },
];

function initials(name, username) {
  const parts = String(name || username || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return String(username || 'U').slice(0, 2).toUpperCase();
}

function profileSnapshot(p) {
  return JSON.stringify({
    full_name: p?.full_name || '',
    email: p?.email || '',
    org: p?.org || '',
    designation: p?.designation || '',
  });
}

function prefsSnapshot(p, theme) {
  return JSON.stringify({
    timezone: p?.timezone || 'Asia/Kolkata',
    date_format: p?.date_format || 'ist',
    display_density: p?.display_density || 'comfortable',
    landing_page: p?.landing_page || 'overview',
    default_alerts_view: p?.default_alerts_view || 'alerts',
    theme: theme || p?.theme || 'light',
  });
}

export function UserSettings({ currentUser, onUserUpdate }) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileBaseline, setProfileBaseline] = useState('');
  const [prefs, setPrefs] = useState({});
  const [prefsBaseline, setPrefsBaseline] = useState('');
  const [mfa, setMfa] = useState({ enabled: false });
  const [enroll, setEnroll] = useState(null);
  const [otp, setOtp] = useState('');
  const [mfaEnrollBusy, setMfaEnrollBusy] = useState(false);
  const [backups, setBackups] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionConfirm, setSessionConfirm] = useState(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [a11y, setA11y] = useState(() => loadA11yPrefs());

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
      setProfileBaseline(profileSnapshot(me));
      const pref = p || {};
      setPrefs(pref);
      setPrefsBaseline(prefsSnapshot(pref, pref.theme));
      cacheWorkspacePrefs(pref);
      if (pref.theme) setTheme(pref.theme);
      if (pref.display_density) writeDensity(pref.display_density);
      setMfa(m || { enabled: false });
      setSessions(sess?.sessions || []);
    } catch (e) {
      notifyError(e?.message || unableToLoad('account settings'));
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  useEffect(() => { load(); }, [load]);

  const avatar = useMemo(
    () => initials(profile?.full_name, profile?.username),
    [profile?.full_name, profile?.username],
  );

  const profileDirty = profile && profileBaseline !== profileSnapshot(profile);
  const prefsDirty = prefsBaseline !== prefsSnapshot(prefs, theme);

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
      setProfileBaseline(profileSnapshot(updated));
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
      setPrefsBaseline(prefsSnapshot(p, p.theme));
      cacheWorkspacePrefs(p);
      if (p.display_density) writeDensity(p.display_density);
      if (p.theme) setTheme(p.theme);
      notifySuccess('Preferences saved.');
    } catch (e) {
      notifyError(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const patchPref = async (patch) => {
    const merged = { ...prefs, ...patch, theme: theme || prefs.theme };
    setPrefs(merged);
    try {
      const p = await api.patchUserPreferences(merged);
      setPrefs(p);
      setPrefsBaseline(prefsSnapshot(p, p.theme));
      cacheWorkspacePrefs(p);
      if (p.display_density) writeDensity(p.display_density);
    } catch (e) {
      notifyError(e?.message || 'Could not save preference.');
      await load();
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
      setOtp('');
    } catch (e) {
      notifyError(e?.message || 'Could not start two-factor setup.');
    }
  };

  const cancelMfaEnroll = () => {
    setEnroll(null);
    setOtp('');
  };

  const confirmMfa = async () => {
    setMfaEnrollBusy(true);
    try {
      const r = await api.confirmMfaEnroll(otp);
      setMfa({ enabled: true });
      setBackups(r.backup_codes || []);
      setEnroll(null);
      setOtp('');
      notifySuccess('Two-factor authentication enabled.');
    } catch (e) {
      notifyError(e?.message || 'Invalid code.');
    } finally {
      setMfaEnrollBusy(false);
    }
  };

  const disableMfa = async () => {
    try {
      await api.disableMfa(otp);
      setMfa({ enabled: false });
      setOtp('');
      notifySuccess('Two-factor authentication disabled.');
    } catch (e) {
      notifyError(e?.message || 'Could not disable two-factor authentication.');
    }
  };

  const displayRole = profile?.role_label
    || roleLabel(profile?.role || currentUser?.role)
    || profile?.role
    || currentUser?.role;
  const otherSessionCount = useMemo(
    () => sessions.filter((s) => !s.current).length,
    [sessions],
  );

  const createdLabel = profile?.created_at ? formatIST(profile.created_at) : null;

  if (loading || !profile) return <BoneyardSkeleton layout="settings" />;

  return (
    <div className="page-stack us-page">
      <header className="us-page-head">
        <h1 className="us-page-head__title">Account settings</h1>
        <p className="us-page-head__desc">
          Manage your identity, security, and personal workspace experience.
        </p>
      </header>

      <div className="us-shell">
        <aside className="us-sidebar">
          <div className="us-identity">
            <div className="us-avatar" aria-hidden>{avatar}</div>
            <h2 className="us-identity__name">{profile.full_name || profile.username}</h2>
            <p className="us-identity__meta">@{profile.username}</p>
            <p className="us-identity__meta">
              {profile.email || 'No email address added'}
            </p>
            <span className="us-role" title={displayRole}>{displayRole}</span>
          </div>
          <nav className="us-nav" aria-label="Settings sections">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="us-nav__group">
                <p className="us-nav__group-title">{group.title}</p>
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`us-nav__btn${tab === id ? ' is-active' : ''}`}
                    aria-current={tab === id ? 'page' : undefined}
                    onClick={() => setTab(id)}
                  >
                    <Icon size={18} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="us-main">
          {tab === 'profile' && (
            <section className="us-card" aria-labelledby="us-profile-h">
              <header className="us-card__head">
                <h2 id="us-profile-h" className="us-card__title">Personal information</h2>
                <p className="us-card__desc">
                  Your profile identifies you in operational activity, comments, and audit records.
                </p>
              </header>
              <div className="us-profile-layout">
                <div className="us-card__body">
                  <div className="us-grid us-grid--profile">
                    <div className="us-field us-field--readonly">
                      <span className="us-field__label">Username</span>
                      <p className="us-readonly-value">{profile.username}</p>
                    </div>
                    <div className="us-field">
                      <label htmlFor="us-full-name">Display name</label>
                      <input
                        id="us-full-name"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Name shown in the console"
                      />
                    </div>
                    <div className="us-field">
                      <label htmlFor="us-email">Email address</label>
                      <input
                        id="us-email"
                        type="email"
                        value={profile.email || ''}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        placeholder="you@organisation.example"
                      />
                    </div>
                    <div className="us-field">
                      <label htmlFor="us-org">Organization</label>
                      <input
                        id="us-org"
                        value={profile.org || ''}
                        onChange={(e) => setProfile({ ...profile, org: e.target.value })}
                        placeholder="Institution or team"
                      />
                    </div>
                    <div className="us-field us-field--span2">
                      <label htmlFor="us-designation">Designation</label>
                      <input
                        id="us-designation"
                        value={profile.designation || ''}
                        onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                        placeholder="Operations engineer"
                      />
                    </div>
                  </div>
                </div>
                <aside className="us-meta-panel" aria-label="Account information">
                  <h3 className="us-meta-panel__title">Account information</h3>
                  <dl className="us-meta-panel__list">
                    <div>
                      <dt>Assigned role</dt>
                      <dd>{displayRole}</dd>
                    </div>
                    <div>
                      <dt>Email address</dt>
                      <dd>{profile.email || 'Not provided'}</dd>
                    </div>
                    {createdLabel ? (
                      <div>
                        <dt>Account created</dt>
                        <dd>{createdLabel}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Two-factor authentication</dt>
                      <dd>{mfa.enabled ? 'Enabled' : 'Not enabled'}</dd>
                    </div>
                  </dl>
                </aside>
              </div>
              <div className="us-actions us-actions--inset">
                {profileDirty ? (
                  <p className="us-actions__hint" role="status">Unsaved changes</p>
                ) : (
                  <p className="us-actions__hint">Changes apply to your account.</p>
                )}
                <button type="button" className="btn btn-primary" disabled={saving || !profileDirty} onClick={saveProfile}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </section>
          )}

          {tab === 'security' && (
            <>
              <div className="us-security-summary" role="status">
                <div className={`us-security-pill${mfa.enabled ? ' is-on' : ''}`}>
                  <span>Two-factor</span>
                  <strong>{mfa.enabled ? 'Enabled' : 'Off'}</strong>
                </div>
                <div className="us-security-pill">
                  <span>Other sessions</span>
                  <strong>{otherSessionCount === 0 ? 'None' : otherSessionCount}</strong>
                </div>
              </div>

              <section className="us-card">
                <header className="us-card__head">
                  <h2 className="us-card__title">Change password</h2>
                  <p className="us-card__desc">
                    Changing your password signs you out of other active sessions. Use at least 6 characters;
                    confirmation must match.
                  </p>
                </header>
                <div className="us-card__body">
                  <div className="us-grid us-grid--narrow">
                    <SettingsPasswordField
                      id="us-pw-current"
                      label="Current password"
                      autoComplete="current-password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                    />
                    <SettingsPasswordField
                      id="us-pw-new"
                      label="New password"
                      autoComplete="new-password"
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                    />
                    <SettingsPasswordField
                      id="us-pw-confirm"
                      label="Confirm new password"
                      autoComplete="new-password"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="us-actions us-actions--inset">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pwBusy || !pwCurrent || !pwNew}
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
                        await load();
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
                  <h2 className="us-card__title">Two-factor authentication</h2>
                  <p className="us-card__desc">
                    Protect your account using a verification code from an authenticator app.
                  </p>
                </header>
                <div className="us-card__body">
                  {!mfa.enabled && !enroll && (
                    <button type="button" className="btn btn-primary" onClick={startMfa}>
                      Set up two-factor authentication
                    </button>
                  )}
                  {mfa.enabled && (
                    <div className="us-mfa-status">
                      <p>
                        Two-factor authentication is <strong>enabled</strong>
                        {mfa.enrolled_at ? ` since ${mfa.enrolled_at}` : ''}.
                      </p>
                      <div className="us-field us-field--narrow">
                        <label htmlFor="us-mfa-disable-code">Authenticator code to disable</label>
                        <input
                          id="us-mfa-disable-code"
                          inputMode="numeric"
                          className="us-mfa-enroll__otp"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="000000"
                        />
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={disableMfa}>
                        Disable two-factor authentication
                      </button>
                    </div>
                  )}
                  {backups && (
                    <div className="us-mfa-box">
                      <p><strong>Save these recovery codes once.</strong> They will not be shown again.</p>
                      <div className="us-backups">{backups.map((c) => <code key={c}>{c}</code>)}</div>
                    </div>
                  )}
                </div>
              </section>

              <section className="us-card us-sessions-card" data-tour="page-settings-sessions">
                <header className="us-card__head">
                  <h2 className="us-card__title">Devices and sessions</h2>
                  <p className="us-card__desc">
                    When the session limit is reached, older sessions are automatically signed out.
                  </p>
                </header>
                <div className="us-card__body">
                  {sessions.length === 0 ? (
                    <p className="page-hint">Session details appear after a normal sign-in.</p>
                  ) : (
                    <>
                      {sessions.filter((s) => s.current).map((s) => (
                        <div key={s.session_id} className="us-session-current">
                          <strong>This device</strong>
                          <span className="page-hint">
                            Signed in {formatIST(new Date((s.created_at || 0) * 1000).toISOString())}
                            {' · '}
                            Expires {formatIST(new Date((s.expires_at || 0) * 1000).toISOString())}
                          </span>
                        </div>
                      ))}
                      {otherSessionCount > 0 ? (
                        <div className="us-session-others">
                          <p className="page-hint">
                            {otherSessionCount === 1
                              ? 'One other active session'
                              : `${otherSessionCount} other active sessions`}
                          </p>
                          <button
                            type="button"
                            className="btn btn-secondary btn--sm"
                            disabled={sessionsBusy}
                            onClick={() => setSessionConfirm({ type: 'all' })}
                          >
                            Sign out other devices
                          </button>
                        </div>
                      ) : (
                        <p className="page-hint">No other active sessions.</p>
                      )}
                    </>
                  )}
                </div>
              </section>
            </>
          )}

          {tab === 'notifications' && (
            <section className="us-card">
              <header className="us-card__head">
                <h2 className="us-card__title">Notification preferences</h2>
                <p className="us-card__desc">
                  Choose what appears in the notification panel. Toggles save immediately.
                  Email delivery uses the same choices when outbound mail is configured.
                </p>
              </header>
              <div className="us-card__body">
                {NOTIFY_GROUPS.map((group) => (
                  <div key={group.title} className="us-notify-group">
                    <h3 className="us-notify-group__title">{group.title}</h3>
                    <ul className="us-toggle-list">
                      {group.rows.map(([key, label, hint]) => (
                        <li key={key} className="us-toggle-row">
                          <div className="us-toggle-row__copy">
                            <strong>{label}</strong>
                            <p>{hint}</p>
                          </div>
                          <Toggle
                            className="us-toggle-row__switch"
                            checked={prefs[key] !== false}
                            aria-label={label}
                            onChange={(on) => patchPref({ [key]: on })}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'appearance' && (
            <section className="us-card">
              <header className="us-card__head">
                <h2 className="us-card__title">Appearance</h2>
                <p className="us-card__desc">
                  Theme is saved to your account. Accessibility options (text size, motion) are in the Accessibility section.
                </p>
              </header>
              <div className="us-card__body">
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
                <div className="us-field us-field--narrow" style={{ marginTop: 20 }}>
                  <label htmlFor="us-density">Display density</label>
                  <select
                    id="us-density"
                    value={prefs.display_density || 'comfortable'}
                    onChange={(e) => setPrefs({ ...prefs, display_density: e.target.value })}
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
              </div>
              <div className="us-actions us-actions--inset">
                {prefsDirty ? <p className="us-actions__hint" role="status">Unsaved appearance changes</p> : null}
                <button type="button" className="btn btn-primary" disabled={saving || !prefsDirty} onClick={savePrefs}>
                  {saving ? 'Saving…' : 'Save appearance'}
                </button>
              </div>
            </section>
          )}

          {tab === 'workspace' && (
            <section className="us-card">
              <header className="us-card__head">
                <h2 className="us-card__title">Workspace preferences</h2>
                <p className="us-card__desc">
                  Time zone and defaults apply across dashboards and tables after you save.
                </p>
              </header>
              <div className="us-card__body">
                <div className="us-grid">
                  <div className="us-field">
                    <label htmlFor="us-tz">Time zone</label>
                    <input
                      id="us-tz"
                      value={prefs.timezone || 'Asia/Kolkata'}
                      onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                      placeholder="Asia/Kolkata"
                    />
                  </div>
                  <div className="us-field">
                    <label htmlFor="us-date">Date format</label>
                    <select
                      id="us-date"
                      value={prefs.date_format || 'ist'}
                      onChange={(e) => setPrefs({ ...prefs, date_format: e.target.value })}
                    >
                      <option value="ist">IST (en-IN)</option>
                      <option value="iso">ISO 8601</option>
                    </select>
                  </div>
                  <div className="us-field us-field--select">
                    <label htmlFor="us-landing">Default landing page</label>
                    <select
                      id="us-landing"
                      value={prefs.landing_page || 'overview'}
                      onChange={(e) => setPrefs({ ...prefs, landing_page: e.target.value })}
                    >
                      <option value="overview">Fleet overview</option>
                      <option value="alerts">Alerts workspace</option>
                      <option value="operations">Operator console</option>
                    </select>
                    <span className="us-field__help">Choose which page opens when you use Home in the shell.</span>
                  </div>
                  <div className="us-field us-field--select">
                    <label htmlFor="us-alerts-tab">Alerts workspace default tab</label>
                    <select
                      id="us-alerts-tab"
                      value={prefs.default_alerts_view || 'alerts'}
                      onChange={(e) => setPrefs({ ...prefs, default_alerts_view: e.target.value })}
                    >
                      <option value="alerts">Active alerts</option>
                      <option value="incidents">Open incidents</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="us-actions us-actions--inset">
                {prefsDirty ? <p className="us-actions__hint" role="status">Unsaved workspace changes</p> : null}
                <button type="button" className="btn btn-primary" disabled={saving || !prefsDirty} onClick={savePrefs}>
                  {saving ? 'Saving…' : 'Save workspace'}
                </button>
              </div>
            </section>
          )}

          {tab === 'accessibility' && (
            <section className="us-card us-a11y-embed">
              <header className="us-card__head">
                <h2 className="us-card__title">Accessibility</h2>
                <p className="us-card__desc">
                  These settings apply in this browser and sync with the accessibility menu in the header.
                </p>
              </header>
              <div className="us-card__body">
                <A11yPanel settings={a11y} onChange={setA11y} onClose={() => {}} />
              </div>
            </section>
          )}
        </div>
      </div>

      {enroll ? (
        <MfaTotpEnrollModal
          enroll={enroll}
          otp={otp}
          onOtpChange={setOtp}
          onConfirm={confirmMfa}
          onCancel={cancelMfaEnroll}
          confirming={mfaEnrollBusy}
        />
      ) : null}

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