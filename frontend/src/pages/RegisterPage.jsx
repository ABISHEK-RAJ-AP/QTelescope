import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Building2, Check } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/observability/ConfirmDialog'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'
import { notifyInfo } from '@/lib/toast'
import { COPY } from '@/copy/operator.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUSTOM_ORG_ID = '__custom__';
const ACCESS_OPTIONS = [
  { value: 'Operator', label: 'Operations' },
  { value: 'Researcher', label: 'Research' },
];

function normOrg(s) {
  return (s || '').trim().toLowerCase();
}

function OtpInput({ value, onChange, disabled, invalid }) {
  const digits = (value || '').padEnd(6, ' ').split('').slice(0, 6);
  return (
    <div className={`auth-otp-row${invalid ? ' auth-otp-row--invalid' : ''}`}>
      {digits.map((ch, i) => (
        <span key={i} className={`auth-otp-cell${ch.trim() ? ' auth-otp-cell--filled' : ''}`} aria-hidden>
          {ch.trim() || '·'}
        </span>
      ))}
      <input
        id="reg-otp"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        className="auth-otp-input"
        value={value}
        disabled={disabled}
        aria-label="Verification code"
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('profile')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [orgCustom, setOrgCustom] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [access, setAccess] = useState('Operator')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [fieldErrors, setFieldErrors] = useState({})
  const [orgOptions, setOrgOptions] = useState([])
  const [registeredOrgs, setRegisteredOrgs] = useState([])
  const [otpSessionId, setOtpSessionId] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpDelivery, setOtpDelivery] = useState('email')
  const [orgDialog, setOrgDialog] = useState(null)

  const registeredSet = useMemo(
    () => new Set(registeredOrgs.map(normOrg)),
    [registeredOrgs],
  );

  const catalogue = useMemo(() => {
    const otherLabel = 'Other facility';
    const fromApi = (orgOptions || []).filter(
      (o) => o && !/other|contact admin/i.test(o),
    );
    return [...fromApi, { id: otherLabel, label: otherLabel, custom: true }];
  }, [orgOptions]);

  const orgValue = useMemo(() => {
    if (!selectedOrgId) return '';
    if (selectedOrgId === CUSTOM_ORG_ID) return orgCustom.trim();
    return selectedOrgId;
  }, [selectedOrgId, orgCustom]);

  useEffect(() => {
    let cancelled = false
    api.getRegistrationOptions()
      .then((reg) => {
        if (cancelled) return;
        setRegistrationOpen(reg?.allow_public_registration !== false);
        setOrgOptions(reg?.org_options || []);
        setRegisteredOrgs(reg?.registered_orgs || []);
      })
      .catch(() => { if (!cancelled) setRegistrationOpen(true) })
      .finally(() => { if (!cancelled) setPolicyLoading(false) })
    return () => { cancelled = true }
  }, [])

  const trySelectOrg = (tile) => {
    setError('');
    const name = tile.custom ? '' : tile.label;
    if (tile.custom) {
      setSelectedOrgId(CUSTOM_ORG_ID);
      setOrgCustom('');
      return;
    }
    if (registeredSet.has(normOrg(name))) {
      setOrgDialog({
        title: 'Organisation already on file',
        body: `${name} already has accounts in this console. Ask that organisation's platform administrator to invite you, or sign in with credentials they issued.`,
        confirm: 'Understood',
      });
      return;
    }
    setSelectedOrgId(name);
    setOrgCustom('');
  };

  const validateDetails = () => {
    const next = {}
    if (!orgValue) next.org = 'Select an organisation and complete the name if needed.'
    if (orgValue && registeredSet.has(normOrg(orgValue))) {
      next.org = 'This organisation is already registered.'
    }
    const u = username.trim()
    if (!u || u.length < 3) next.username = 'At least 3 characters.'
    if (!email.trim()) next.email = 'Required.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email.'
    if (!password || password.length < 6) next.password = 'At least 6 characters.'
    if (password !== confirmPassword) next.confirmPassword = 'Passwords must match.'
    if (!captchaCode.trim()) next.captcha = 'Enter the image characters.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!selectedOrgId) {
      setError('Select your organisation.')
      return
    }
    if (!validateDetails()) {
      setError('Check the highlighted fields.')
      return
    }

    setBusy(true)
    try {
      const res = await api.registerSendOtp({
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        email: email.trim(),
        org: orgValue,
        role: access,
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      if (res?.status !== 'SUCCESS') throw new Error(res?.message || 'Could not send code.')
      setOtpSessionId(res.otp_session_id || '')
      setOtpDelivery(res.delivery || 'email')
      setStep('otp')
      setOtpCode('')
      if (res.delivery === 'screen' && res.screen_otp) {
        notifyInfo(`Verification code: ${res.screen_otp}`, { toastId: 'register-otp-demo', autoClose: 45000 })
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.')
      setCaptchaKey((k) => k + 1)
      setCaptchaCode('')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (otpCode.trim().length < 6) {
      setFieldErrors({ otp: 'Enter all 6 digits.' })
      return
    }
    setBusy(true)
    try {
      const res = await api.registerConfirm({
        otp_session_id: otpSessionId,
        otp_code: otpCode.trim(),
      })
      if (res?.status === 'SUCCESS') {
        markOnboardingPending(username.trim())
        setSuccess(res?.message || 'Account created.')
        setTimeout(() => navigate('/login'), res?.pending_admin_approval ? 2400 : 1400)
      }
    } catch (err) {
      setError(err?.message || 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <p className="auth-cert-card__footer-text">
      Already have an account?{' '}
      <Link to="/login" className="auth-cert-card__link">Sign in</Link>
    </p>
  );

  if (!policyLoading && !registrationOpen) {
    return (
      <AuthShell layout="cert" title="Create account" subtitle={COPY.auth.registerClosed} footer={footer} maxWidth="max-w-lg">
        <p className="text-sm text-[var(--text-muted)]">
          Self-service registration is off for this deployment.{' '}
          <Link to="/login" className="auth-cert-card__link">Sign in</Link> or contact your platform administrator.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      layout="cert"
      title="Create account"
      subtitle={COPY.auth.registerSubtitle}
      footer={footer}
      maxWidth="max-w-3xl"
    >
      {orgDialog ? (
        <ConfirmDialog
          dlg={orgDialog}
          onCancel={() => setOrgDialog(null)}
          onConfirm={() => setOrgDialog(null)}
        />
      ) : null}

      {success ? (
        <p className="auth-inline-alert auth-inline-alert--success" role="status">{success}</p>
      ) : (
        <div className={`reg-org-layout${selectedOrgId ? ' reg-org-layout--detail' : ''}`}>
          <div className="reg-org-layout__picker" aria-label="Organisation">
            <p className="reg-org-layout__aside-title">Organisation</p>
            <ul className="reg-org-tiles" role="listbox" aria-label="Select organisation">
              {catalogue.map((tile) => {
                const id = tile.custom ? CUSTOM_ORG_ID : tile.label;
                const active = selectedOrgId === id || (tile.custom && selectedOrgId === CUSTOM_ORG_ID);
                const taken = !tile.custom && registeredSet.has(normOrg(tile.label));
                return (
                  <li key={tile.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`reg-org-tile${active ? ' reg-org-tile--active' : ''}${taken ? ' reg-org-tile--taken' : ''}`}
                      onClick={() => trySelectOrg(tile)}
                    >
                      <Building2 className="size-4 shrink-0 opacity-70" aria-hidden />
                      <span className="reg-org-tile__label">{tile.label}</span>
                      {active ? <Check className="size-4 shrink-0 reg-org-tile__check" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="reg-org-layout__panel">
            {!selectedOrgId ? (
              <p className="reg-org-layout__placeholder">Select your lab or facility to continue.</p>
            ) : step === 'otp' ? (
              <form onSubmit={handleConfirmOtp} className="reg-org-form" noValidate>
                <p className="reg-org-form__lead">
                  {otpDelivery === 'screen'
                    ? COPY.auth.registerOtpHint
                    : `Code sent to ${email.trim()}.`}
                </p>
                <Field label="Verification code" forId="reg-otp" hint={fieldErrors.otp}>
                  <OtpInput
                    value={otpCode}
                    onChange={(v) => { setOtpCode(v); setFieldErrors((f) => ({ ...f, otp: undefined })); }}
                    disabled={busy}
                    invalid={Boolean(fieldErrors.otp)}
                  />
                </Field>
                {error ? <p className="auth-field-error" role="alert">{error}</p> : null}
                <div className="reg-org-form__actions">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => { setStep('profile'); setError(''); }}>
                    Back
                  </Button>
                  <Button type="submit" className="auth-cta flex-1" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Verify and finish
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSendOtp} className="reg-org-form" noValidate>
                <p className="reg-org-form__org-name">{orgValue || '—'}</p>
                {selectedOrgId === CUSTOM_ORG_ID ? (
                  <Field label="Facility name" forId="reg-org-custom" hint={fieldErrors.org}>
                    <input
                      id="reg-org-custom"
                      type="text"
                      className={`${fieldClass} ${fieldErrors.org ? 'auth-field--invalid' : ''}`}
                      value={orgCustom}
                      onChange={(e) => {
                        setOrgCustom(e.target.value);
                        setFieldErrors((f) => ({ ...f, org: undefined }));
                        if (registeredSet.has(normOrg(e.target.value))) {
                          setOrgDialog({
                            title: 'Name already registered',
                            body: "This organisation name matches an existing directory entry. Contact that facility's administrator for an invitation.",
                            confirm: 'OK',
                          });
                        }
                      }}
                      placeholder="Facility or programme"
                      autoComplete="organization"
                    />
                  </Field>
                ) : null}

                <div className="reg-org-form__grid">
                  <Field label="Username" forId="reg-username" hint={fieldErrors.username}>
                    <input
                      id="reg-username"
                      className={`${fieldClass} ${fieldErrors.username ? 'auth-field--invalid' : ''}`}
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setFieldErrors((f) => ({ ...f, username: undefined })); }}
                      autoComplete="username"
                      required
                    />
                  </Field>
                  <Field label="Full name" forId="reg-fullname">
                    <input id="reg-fullname" className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                  </Field>
                  <Field label="Email" forId="reg-email" hint={fieldErrors.email}>
                    <input
                      id="reg-email"
                      type="email"
                      className={`${fieldClass} ${fieldErrors.email ? 'auth-field--invalid' : ''}`}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field label="Access" forId="reg-access">
                    <select id="reg-access" className={fieldClass} value={access} onChange={(e) => setAccess(e.target.value)}>
                      {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Password" forId="reg-password" hint={fieldErrors.password}>
                    <div className="reg-org-password">
                      <input
                        id="reg-password"
                        type={showPw ? 'text' : 'password'}
                        className={`${fieldClass} ${fieldErrors.password ? 'auth-field--invalid' : ''}`}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
                        autoComplete="new-password"
                        required
                      />
                      <button type="button" className="reg-org-password__toggle" aria-label={showPw ? 'Hide' : 'Show'} onClick={() => setShowPw((v) => !v)}>
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm" forId="reg-confirm" hint={fieldErrors.confirmPassword}>
                    <input
                      id="reg-confirm"
                      type={showPw ? 'text' : 'password'}
                      className={`${fieldClass} ${fieldErrors.confirmPassword ? 'auth-field--invalid' : ''}`}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((f) => ({ ...f, confirmPassword: undefined })); }}
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                </div>

                <CaptchaField
                  key={captchaKey}
                  value={captchaCode}
                  onChange={(v) => { setCaptchaCode(v); setFieldErrors((f) => ({ ...f, captcha: undefined })); }}
                  onChallenge={setCaptchaId}
                />
                {fieldErrors.captcha ? <p className="auth-field-error">{fieldErrors.captcha}</p> : null}
                {error ? <p className="auth-field-error qt-shake" role="alert">{error}</p> : null}

                <Button type="submit" className="auth-cta w-full" disabled={busy || !orgValue}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Send verification code
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  )
}