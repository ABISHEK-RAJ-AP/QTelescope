import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchCaptcha, loginWithCredentials, saveSessionUser } from './auth.js';
import DevAuthLocalPanel, { isDevAuthAllowed, QRE_DEV_AUTH_HOST_ID } from './DevAuthLocalPanel.jsx';
import { demoCredentialsForRole } from './devAuthConfig.js';
import QreCaptchaField from './QreCaptchaField.jsx';

export default function QreInlineSignIn({
  appName,
  subtitle,
  onSuccess,
  devContinueSlot = null,
  onFieldChange = null,
  hideDecorativeIcons = false,
  onRegister = null,
  onForgotPassword = null,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaBusy, setCaptchaBusy] = useState(false);
  const [devBusy, setDevBusy] = useState(false);

  const [devMode, setDevMode] = useState('manual');
  const [devRole, setDevRole] = useState(() => localStorage.getItem('qre_role') || 'Researcher');
  const [demoRole, setDemoRole] = useState('Admin');

  const showDevPanel = isDevAuthAllowed;
  const showCredentialFields = !showDevPanel || devMode !== 'devHeaders';
  const showCaptchaAndSubmit = !showDevPanel || devMode !== 'devHeaders';

  function syncFields(u, p, c) {
    onFieldChange?.setUsername?.(u);
    onFieldChange?.setPassword?.(p);
    onFieldChange?.setCaptchaInput?.(c);
  }

  const applyDemoCredentials = useCallback(
    (role) => {
      const creds = demoCredentialsForRole(role);
      if (!creds) return;
      setUsername(creds.username);
      setPassword(creds.password);
      syncFields(creds.username, creds.password, captchaCode);
    },
    [captchaCode, onFieldChange],
  );

  async function loadCaptcha() {
    setCaptchaBusy(true);
    setError('');
    try {
      const c = await fetchCaptcha();
      setCaptchaId(c.captcha_id);
      setCaptchaImage(c.captcha_image);
      setCaptchaCode('');
      syncFields(username, password, '');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setCaptchaBusy(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  useEffect(() => {
    if (devMode !== 'demo' || !demoRole) return;
    applyDemoCredentials(demoRole);
  }, [devMode, demoRole, applyDemoCredentials]);

  function continueDevHeaders() {
    setDevBusy(true);
    localStorage.setItem('qre_role', devRole);
    localStorage.setItem('qre_user', devRole);
    sessionStorage.setItem('qre_govern_dev', '1');
    window.dispatchEvent(new CustomEvent('qre-role-changed', { detail: devRole }));
    const path = (window.location.hash || '#/').replace(/^#/, '').split('?')[0];
    if (path === '/sign-in' || path === '/register' || path === '') {
      window.location.hash = '#/';
    }
    window.location.reload();
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let u = username.trim();
      let p = password;
      if (devMode === 'demo' && demoRole) {
        const creds = demoCredentialsForRole(demoRole);
        if (creds) {
          u = creds.username;
          p = creds.password;
        }
      }
      const user = await loginWithCredentials({
        username: u,
        password: p,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      });
      saveSessionUser(user);
      sessionStorage.removeItem('qre_govern_dev');
      onSuccess?.(user);
    } catch (err) {
      setError(String(err.message || err));
      await loadCaptcha();
    } finally {
      setBusy(false);
    }
  }

  const [devHost, setDevHost] = useState(null);
  useEffect(() => {
    setDevHost(document.getElementById(QRE_DEV_AUTH_HOST_ID));
  }, []);

  const devPanel = showDevPanel ? (
    <DevAuthLocalPanel
      layout="aside"
      mode={devMode}
      onModeChange={setDevMode}
      devRole={devRole}
      onDevRoleChange={setDevRole}
      demoRole={demoRole}
      onDemoRoleChange={setDemoRole}
      onApplyDemoCredentials={applyDemoCredentials}
      onContinueDevHeaders={continueDevHeaders}
      devBusy={devBusy}
    />
  ) : null;

  return (
    <>
      <form className="qre-auth-gate__form govern-stack qre-inline-sign-in" onSubmit={submit}>
        {!hideDecorativeIcons && (
          <p className="qre-auth-gate__sub" style={{ marginTop: 0 }}>
            {subtitle || `Sign in to ${appName}.`}
          </p>
        )}
        {hideDecorativeIcons && subtitle && (
          <p className="qre-auth-gate__sub qre-inline-sign-in__sub">{subtitle}</p>
        )}

        {showCredentialFields ? (
          <>
            <label className="qre-field">
              <span className="qre-field__label">Username</span>
              <input
                className="qre-field__input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  syncFields(e.target.value, password, captchaCode);
                }}
                autoComplete="username"
                required={devMode === 'manual'}
              />
            </label>
            <label className="qre-field">
              <div className="cert-login-password-row">
                <span className="qre-field__label">Password</span>
                {onForgotPassword ? (
                  <button type="button" className="cert-auth-link cert-auth-link--inline" onClick={onForgotPassword}>
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <input
                className="qre-field__input"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  syncFields(username, e.target.value, captchaCode);
                }}
                autoComplete="current-password"
                required={devMode === 'manual'}
              />
            </label>
          </>
        ) : null}

        {showCaptchaAndSubmit ? (
          <>
            <QreCaptchaField
              captchaImage={captchaImage}
              captchaCode={captchaCode}
              busy={captchaBusy}
              onReload={loadCaptcha}
              onCaptchaCodeChange={(v) => {
                setCaptchaCode(v);
                syncFields(username, password, v);
              }}
            />
            {error && <p className="qre-alert">{error}</p>}
            <button type="submit" className="qre-btn qre-btn--primary qre-inline-sign-in__submit" disabled={busy || !captchaId}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        ) : null}

        {devContinueSlot}

        {onRegister ? (
          <div className="cert-auth-footer">
            <p>
              Need an account?{' '}
              <button type="button" className="cert-auth-link" onClick={onRegister}>
                Register
              </button>
            </p>
          </div>
        ) : null}
      </form>
      {devPanel ? (devHost ? createPortal(devPanel, devHost) : null) : null}
    </>
  );
}
