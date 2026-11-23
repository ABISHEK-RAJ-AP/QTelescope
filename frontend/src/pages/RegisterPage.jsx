import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  Landmark,
  GraduationCap,
  Building2,
  Rocket,
  FlaskConical,
  Network,
  Globe2,
  HeartHandshake,
  Layers,
} from 'lucide-react'
import { QtTeleScopeMark } from '@/components/brand/QtTeleScopeMark.jsx'
import {
  buildOrgString,
  orgTilesForRegister,
  validateOrgDetail,
  getFieldsForOrgType,
} from '@/data/registerOrgHierarchy'
import { RegisterOrgFields } from '@/components/auth/RegisterOrgFields'
import { RegisterStepTrail } from '@/components/auth/RegisterStepTrail'
import { AuthFridgeVisual } from '@/components/marketing/AuthFridgeVisual'
import { Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/observability/ConfirmDialog'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'
import { dismissRegistrationOtpToast, notifyRegistrationOtp, notifyWarn } from '@/lib/toast'
import { COPY } from '@/copy/operator.js'
import '@/styles/register-cert.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ORG_TYPES = orgTilesForRegister();

const ORG_ICON_MAP = {
  Landmark,
  GraduationCap,
  Building2,
  Rocket,
  FlaskConical,
  Network,
  Globe2,
  HeartHandshake,
  Layers,
};

function RegOrgIcon({ name }) {
  const Icon = ORG_ICON_MAP[name] || Building2;
  return <Icon className="reg-type-tile__icon" strokeWidth={2} aria-hidden />;
}

function normOrg(s) {
  return (s || '').trim().toLowerCase();
}

function OtpInput({ value, onChange, disabled, invalid, matched, showMatchHint }) {
  const raw = value || '';
  const len = raw.length;
  const complete = len >= 6;
  const digits = raw.padEnd(6, ' ').split('').slice(0, 6);
  const rowClass = [
    'auth-otp-row',
    'reg-otp-input-row',
    invalid ? 'auth-otp-row--invalid' : '',
    complete ? 'auth-otp-row--complete' : '',
    matched && complete ? 'auth-otp-row--match' : '',
    showMatchHint && complete && !matched ? 'auth-otp-row--mismatch' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      {digits.map((ch, i) => {
        const filled = Boolean(ch.trim());
        const active = !complete && i === len;
        const cellClass = [
          'auth-otp-cell',
          filled ? 'auth-otp-cell--filled' : '',
          active ? 'auth-otp-cell--active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span key={i} className={cellClass} aria-hidden>
            {filled ? ch : active ? '' : '·'}
          </span>
        );
      })}
      {matched && complete ? (
        <span className="reg-otp-input-row__tick" aria-hidden>
          <Check className="reg-otp-input-row__tick-icon" strokeWidth={2.75} />
        </span>
      ) : null}
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
  const [flowStep, setFlowStep] = useState('type')
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [orgDetail, setOrgDetail] = useState({})
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
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
  const [requiresAdminApproval, setRequiresAdminApproval] = useState(false)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [fieldErrors, setFieldErrors] = useState({})
  const [registeredOrgs, setRegisteredOrgs] = useState([])
  const [otpSessionId, setOtpSessionId] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpDelivery, setOtpDelivery] = useState('email')
  const [screenOtp, setScreenOtp] = useState('')
  const [orgDialog, setOrgDialog] = useState(null)

  const otpComplete = otpCode.trim().length >= 6;
  const otpMatchesScreen = Boolean(
    screenOtp && otpComplete && otpCode.trim() === String(screenOtp).replace(/\s/g, ''),
  );
  const otpShowMatchHint = otpDelivery === 'screen' && Boolean(screenOtp);

  useEffect(() => {
    document.body.classList.add('qt-auth-route');
    return () => document.body.classList.remove('qt-auth-route');
  }, []);

  useEffect(() => {
    if (flowStep !== 'otp' || !screenOtp.trim()) return;
    const t = window.setTimeout(() => notifyRegistrationOtp(screenOtp), 0);
    return () => window.clearTimeout(t);
  }, [flowStep, screenOtp]);

  const selectedType = useMemo(
    () => ORG_TYPES.find((t) => t.id === selectedTypeId) || null,
    [selectedTypeId],
  );

  const orgTypeLabel = selectedType?.label || '';

  const registeredSet = useMemo(
    () => new Set(registeredOrgs.map(normOrg)),
    [registeredOrgs],
  );

  const orgValue = useMemo(
    () => (selectedTypeId ? buildOrgString(selectedTypeId, orgDetail) : ''),
    [selectedTypeId, orgDetail],
  );

  useEffect(() => {
    let cancelled = false
    api.getRegistrationOptions()
      .then((reg) => {
        if (cancelled) return;
        setRegistrationOpen(reg?.allow_public_registration !== false);
        setRequiresAdminApproval(Boolean(reg?.require_admin_approval));
        setRegisteredOrgs(reg?.registered_orgs || []);
        if (reg?.otp_delivery === 'screen' || reg?.otp_delivery === 'email') {
          setOtpDelivery(reg.otp_delivery);
        }
      })
      .catch(() => { if (!cancelled) setRegistrationOpen(true) })
      .finally(() => { if (!cancelled) setPolicyLoading(false) })
    return () => { cancelled = true }
  }, [])

  const pickType = (typeId) => {
    setError('');
    setSelectedTypeId(typeId);
    setOrgDetail({});
    setFieldErrors({});
    setFlowStep('org');
  };

  const goToTypeStep = () => {
    setSelectedTypeId('');
    setOrgDetail({});
    setFlowStep('type');
    setError('');
    setFieldErrors({});
  };

  const goToOrgStep = () => {
    setFlowStep('org');
    setError('');
    setFieldErrors({});
  };

  const setOrgField = (fieldId, value) => {
    setOrgDetail((prev) => {
      const next = { ...prev, [fieldId]: value };
      if (fieldId === 'gov_scope' || fieldId === 'uni_tier') {
        getFieldsForOrgType(selectedTypeId).forEach((f) => {
          if (f.id !== fieldId) next[f.id] = '';
        });
      }
      return next;
    });
    setFieldErrors((f) => ({ ...f, [fieldId]: undefined, org: undefined, _org: undefined }));
  };

  const checkFacilityDuplicate = (fullOrg) => {
    const full = (fullOrg || '').trim();
    if (full && registeredSet.has(normOrg(full))) {
      setOrgDialog({
        title: 'Organisation already registered',
        body: 'This organisation already has console accounts. Contact its platform administrator for an invitation.',
        confirm: 'Understood',
      });
      return true;
    }
    return false;
  };

  const validateOrgStep = () => {
    const next = {};
    if (!selectedTypeId) next.org = 'Choose an organisation type.';
    const orgFieldErrors = selectedTypeId ? validateOrgDetail(selectedTypeId, orgDetail) : {};
    Object.assign(next, orgFieldErrors);
    if (orgFieldErrors._org) next.org = orgFieldErrors._org;
    delete next._org;
    if (orgValue && registeredSet.has(normOrg(orgValue))) {
      next.org = 'This organisation is already registered.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateAccountStep = () => {
    const next = {};
    const u = username.trim();
    if (!u || u.length < 3) next.username = 'At least 3 characters.';
    if (!email.trim()) next.email = 'Required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email.';
    if (!password || password.length < 6) next.password = 'At least 6 characters.';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords must match.';
    if (!captchaCode.trim()) next.captcha = 'Enter the image characters.';
    if (!orgValue) next.org = 'Complete organisation details on the previous step.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleOrgContinue = (e) => {
    e.preventDefault();
    setError('');
    if (!validateOrgStep()) {
      setError('Check the highlighted organisation fields.');
      return;
    }
    setFlowStep('account');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validateAccountStep()) {
      setError('Check the highlighted fields.');
      return;
    }

    setBusy(true)
    try {
      const res = await api.registerSendOtp({
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        email: email.trim(),
        org: orgValue,
        role: 'Operator',
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      if (res?.status !== 'SUCCESS') throw new Error(res?.message || 'Could not send code.')
      setOtpSessionId(res.otp_session_id || '')
      setOtpDelivery(res.delivery || 'email')
      setFlowStep('otp')
      setOtpCode('')
      if (res.screen_otp) {
        const code = String(res.screen_otp).replace(/\s/g, '');
        setScreenOtp(code);
        setOtpDelivery('screen');
        notifyRegistrationOtp(code);
      } else if (res.delivery === 'screen') {
        setScreenOtp('');
        notifyWarn(
          res?.message
            || 'No verification code was returned. Set ENABLE_MOCK_DATA=true or REGISTRATION_OTP_DELIVERY=screen, then restart the API.',
        );
      } else {
        setScreenOtp('');
        dismissRegistrationOtpToast();
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
        dismissRegistrationOtpToast()
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
    <div className="space-y-2 text-sm text-center text-[var(--text-muted)]">
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
      <p className="text-xs leading-relaxed">
        By creating an account you agree to our{' '}
        <Link to="/terms">Terms of Operation</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );

  const panelHeadCopy = {
    type: { title: 'Create account', subtitle: COPY.auth.registerSubtitle },
    org: { title: 'Organisation details', subtitle: COPY.auth.registerOrgStepSubtitle },
    account: { title: 'Account details', subtitle: COPY.auth.registerAccountStepSubtitle },
    otp: { title: 'Verify email', subtitle: COPY.auth.registerOtpSubtitle },
  }[flowStep] || { title: 'Create account', subtitle: COPY.auth.registerSubtitle };

  const asideText = {
    type: COPY.auth.registerTypeAside,
    org: COPY.auth.registerOrgAside,
    account: COPY.auth.registerAccountAside,
    otp: COPY.auth.registerOtpAside,
  }[flowStep];

  const panelHead = (
    <header className="reg-cert-head">
      <h1>{panelHeadCopy.title}</h1>
      <p>{panelHeadCopy.subtitle}</p>
    </header>
  );

  if (!policyLoading && !registrationOpen) {
    return (
      <AuthShell layout="register-studio" footer={footer}>
        {panelHead}
        <p className="text-sm" style={{ color: 'var(--reg-muted)', textAlign: 'center' }}>
          {COPY.auth.registerClosed}{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell layout="register-studio" footer={footer}>
      {orgDialog ? (
        <ConfirmDialog
          dlg={orgDialog}
          onCancel={() => setOrgDialog(null)}
          onConfirm={() => setOrgDialog(null)}
        />
      ) : null}

      {panelHead}
      <RegisterStepTrail current={flowStep} requiresAdminApproval={requiresAdminApproval} />

      {success ? (
        <p className="auth-inline-alert auth-inline-alert--success" role="status">{success}</p>
      ) : (
        <div className={`reg-stage reg-stage--flow reg-stage--step-${flowStep}${flowStep !== 'type' ? ' reg-stage--detail' : ''}`}>
          <div className="reg-stage__brand">
            <QtTeleScopeMark size={48} className="reg-stage__logo-mark" decorative />
            <div className="reg-stage__fridge">
              <AuthFridgeVisual />
            </div>
            {asideText ? (
              <aside className="reg-stage__aside" aria-label="Registration guidance">
                <p className="reg-stage__aside-text">{asideText}</p>
              </aside>
            ) : null}
          </div>

          {flowStep === 'type' ? (
            <div className="reg-stage__types reg-stage__types--hero">
              <p className="reg-stage__label">Organisation type</p>
              <div className="reg-type-grid reg-type-grid--tiles" role="listbox" aria-label="Organisation type">
                {ORG_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={`reg-type-tile${type.isOther ? ' reg-type-tile--other' : ''}`}
                    onClick={() => pickType(type.id)}
                  >
                    <span className="reg-type-tile__row">
                      <RegOrgIcon name={type.icon} />
                      <span className="reg-type-tile__title">{type.label}</span>
                    </span>
                    <span className="reg-type-tile__hint">{type.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <div className="reg-stage__form">
            {flowStep === 'org' ? (
              <form onSubmit={handleOrgContinue} className="reg-form-stack" noValidate>
                <div className="reg-form-type-bar">
                  <div className="reg-form-type-bar__meta">
                    <span className="reg-form-type-bar__label">Type</span>
                    <span className="reg-form-type-bar__value">{orgTypeLabel}</span>
                  </div>
                  <button type="button" className="reg-form-type-bar__back" onClick={goToTypeStep} disabled={busy}>
                    Change type
                  </button>
                </div>
                <RegisterOrgFields
                  typeId={selectedTypeId}
                  values={orgDetail}
                  fieldErrors={fieldErrors}
                  disabled={busy}
                  onChange={setOrgField}
                />
                {fieldErrors.org ? <p className="auth-field-error">{fieldErrors.org}</p> : null}
                {error ? <p className="auth-field-error" role="alert">{error}</p> : null}
                <div className="reg-flow-nav">
                  <button type="button" className="reg-flow-nav__back" onClick={goToTypeStep} disabled={busy}>
                    Back
                  </button>
                  <Button type="submit" className="auth-cta reg-flow-nav__next" disabled={busy}>
                    Continue
                  </Button>
                </div>
              </form>
            ) : null}

            {flowStep === 'account' ? (
              <form onSubmit={handleSendOtp} className="reg-form-stack reg-form-stack--profile" noValidate>
                {orgValue ? (
                  <p className="reg-org-crumb" title={orgValue}>
                    <span className="reg-org-crumb__label">Organisation</span>
                    {orgValue}
                  </p>
                ) : null}
                <div className="reg-form-row reg-form-row--split">
                  <Field label="Username" forId="reg-username" hint={fieldErrors.username}>
                    <input
                      id="reg-username"
                      className={`${fieldClass}${fieldErrors.username ? ' auth-field--invalid qt-shake' : ''}`}
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setFieldErrors((f) => ({ ...f, username: undefined })); }}
                      autoComplete="username"
                      required
                    />
                  </Field>
                  <Field label="Full name" forId="reg-fullname">
                    <input
                      id="reg-fullname"
                      className={fieldClass}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                </div>

                <Field label="Email" forId="reg-email" hint={fieldErrors.email}>
                  <input
                    id="reg-email"
                    type="email"
                    className={`${fieldClass}${fieldErrors.email ? ' auth-field--invalid qt-shake' : ''}`}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
                    autoComplete="email"
                    required
                  />
                </Field>

                <div className="reg-form-row reg-form-row--split">
                  <Field label="Password" forId="reg-password" hint={fieldErrors.password}>
                    <div className="reg-org-password">
                      <input
                        id="reg-password"
                        type={showPw ? 'text' : 'password'}
                        className={`${fieldClass}${fieldErrors.password ? ' auth-field--invalid qt-shake' : ''}`}
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
                      className={`${fieldClass}${fieldErrors.confirmPassword ? ' auth-field--invalid qt-shake' : ''}`}
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
                <div className="reg-flow-nav">
                  <button type="button" className="reg-flow-nav__back" onClick={goToOrgStep} disabled={busy}>
                    Back
                  </button>
                  <Button type="submit" className="auth-cta reg-flow-nav__next" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Send verification code
                  </Button>
                </div>
              </form>
            ) : null}

            {flowStep === 'otp' ? (
              <form onSubmit={handleConfirmOtp} className="reg-form-stack reg-otp-step" noValidate>
                <div className="auth-otp-panel reg-otp-panel">
                  <p className="auth-otp-panel__lead">
                    {otpDelivery === 'screen'
                      ? COPY.auth.registerOtpHintScreen
                      : (
                        <>
                          {COPY.auth.registerOtpHintEmail}
                          {' '}
                          <span className="reg-otp-panel__email">{email.trim()}</span>
                        </>
                      )}
                  </p>
                  {otpDelivery === 'screen' && screenOtp ? (
                    <div className="reg-otp-screen-code" role="status" aria-live="polite">
                      <span className="reg-otp-screen-code__label">{COPY.auth.registerOtpScreenCodeLabel}</span>
                      <code className="reg-otp-screen-code__value">{screenOtp}</code>
                      <button
                        type="button"
                        className="btn btn-secondary btn--sm reg-otp-screen-code__copy"
                        onClick={() => {
                          const code = screenOtp.replace(/\s/g, '');
                          navigator.clipboard?.writeText(code).catch(() => {});
                          notifyRegistrationOtp(code, { autoClose: 8000 });
                        }}
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn--sm"
                        onClick={() => notifyRegistrationOtp(screenOtp)}
                      >
                        Show in toast again
                      </button>
                    </div>
                  ) : null}
                  <Field label="Verification code" forId="reg-otp" hint={fieldErrors.otp}>
                    <OtpInput
                      value={otpCode}
                      onChange={(v) => { setOtpCode(v); setFieldErrors((f) => ({ ...f, otp: undefined })); }}
                      disabled={busy}
                      invalid={Boolean(fieldErrors.otp)}
                      matched={otpMatchesScreen}
                      showMatchHint={otpShowMatchHint}
                    />
                  </Field>
                  {fieldErrors.otp ? (
                    <p className="auth-inline-alert auth-inline-alert--error reg-otp-inline-alert" role="alert">
                      {fieldErrors.otp}
                    </p>
                  ) : null}
                  {!fieldErrors.otp && !error && otpMatchesScreen ? (
                    <p className="auth-inline-alert auth-inline-alert--success reg-otp-inline-alert" role="status">
                      <Check className="reg-otp-inline-alert__icon" strokeWidth={2.5} aria-hidden />
                      Code matches — you can confirm.
                    </p>
                  ) : null}
                  {!fieldErrors.otp && !error && otpShowMatchHint && otpComplete && !otpMatchesScreen ? (
                    <p className="auth-inline-alert auth-inline-alert--error reg-otp-inline-alert" role="status">
                      Digits do not match the verification code above.
                    </p>
                  ) : null}
                  {!fieldErrors.otp && !error && otpComplete && !otpShowMatchHint ? (
                    <p className="auth-inline-alert auth-inline-alert--success reg-otp-inline-alert" role="status">
                      <Check className="reg-otp-inline-alert__icon" strokeWidth={2.5} aria-hidden />
                      Six digits entered — confirm when ready.
                    </p>
                  ) : null}
                </div>
                {error ? <p className="auth-inline-alert auth-inline-alert--error reg-otp-inline-alert" role="alert">{error}</p> : null}
                <div className="reg-flow-nav">
                  <button type="button" className="reg-flow-nav__back" disabled={busy} onClick={() => { setFlowStep('account'); setError(''); }}>
                    Back
                  </button>
                  <Button type="submit" className="auth-cta reg-flow-nav__next" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Confirm code
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
          )}
        </div>
      )}
    </AuthShell>
  )
}