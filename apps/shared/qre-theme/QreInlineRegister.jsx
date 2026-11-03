import { useEffect, useState } from 'react';
import { fetchCaptcha, registerWithCredentials } from './auth.js';
import QreCaptchaField from './QreCaptchaField.jsx';

export default function QreInlineRegister({ onSuccess, onFieldChange = null, footerSlot = null }) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('C-DAC');
  const [role, setRole] = useState('Researcher');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaBusy, setCaptchaBusy] = useState(false);

  function syncWire(u, p, c) {
    onFieldChange?.setUsername?.(u);
    onFieldChange?.setPassword?.(p);
    onFieldChange?.setCaptchaInput?.(c);
  }

  async function loadCaptcha() {
    setCaptchaBusy(true);
    setError('');
    try {
      const c = await fetchCaptcha();
      setCaptchaId(c.captcha_id);
      setCaptchaImage(c.captcha_image);
      setCaptchaCode('');
      syncWire(username, password, '');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setCaptchaBusy(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await registerWithCredentials({
        username: username.trim(),
        password,
        full_name: fullName.trim() || username.trim(),
        email: email.trim(),
        org: org.trim() || 'C-DAC',
        role,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      });
      setSuccess('Account created. Redirecting to sign in…');
      onSuccess?.();
    } catch (err) {
      setError(String(err.message || err));
      await loadCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="qre-auth-gate__form govern-stack qre-inline-sign-in" onSubmit={submit}>
      <div className="qre-inline-register__grid">
        <label className="qre-field">
          <span className="qre-field__label">Username</span>
          <input
            className="qre-field__input"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              syncWire(e.target.value, password, captchaCode);
            }}
            autoComplete="username"
            required
          />
        </label>
        <label className="qre-field">
          <span className="qre-field__label">Full name</span>
          <input
            className="qre-field__input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </label>
      </div>
      <label className="qre-field">
        <span className="qre-field__label">Email</span>
        <input
          className="qre-field__input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <div className="qre-inline-register__grid">
        <label className="qre-field">
          <span className="qre-field__label">Organization</span>
          <input className="qre-field__input" value={org} onChange={(e) => setOrg(e.target.value)} />
        </label>
        <label className="qre-field">
          <span className="qre-field__label">Role</span>
          <select className="qre-field__input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Researcher">Researcher</option>
            <option value="Operator">Operator</option>
          </select>
        </label>
      </div>
      <label className="qre-field">
        <span className="qre-field__label">Password</span>
        <input
          className="qre-field__input"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            syncWire(username, e.target.value, captchaCode);
          }}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="qre-field">
        <span className="qre-field__label">Confirm password</span>
        <input
          className="qre-field__input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <QreCaptchaField
        captchaImage={captchaImage}
        captchaCode={captchaCode}
        busy={captchaBusy}
        onReload={loadCaptcha}
        onCaptchaCodeChange={(v) => {
          setCaptchaCode(v);
          syncWire(username, password, v);
        }}
      />
      {error && <p className="qre-alert">{error}</p>}
      {success && <p className="qre-alert qre-alert--success">{success}</p>}
      <button type="submit" className="qre-btn qre-btn--primary qre-inline-sign-in__submit" disabled={busy || !captchaId || !!success}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      {footerSlot}
    </form>
  );
}
