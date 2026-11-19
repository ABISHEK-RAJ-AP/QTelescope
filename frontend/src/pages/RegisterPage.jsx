import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Loader2,
  Landmark,
  GraduationCap,
  Building2,
  Rocket,
  FlaskConical,
  Network,
  Globe2,
  HeartHandshake,
  Layers,
  ChevronLeft,
} from 'lucide-react'
import cdacLogo from '../assets/cdaclogo.png'
import { AuthFridgeVisual } from '@/components/marketing/AuthFridgeVisual'
import { Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/observability/ConfirmDialog'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'
import { notifyInfo } from '@/lib/toast'
import { COPY } from '@/copy/operator.js'
import '@/styles/register-cert.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ORG_TYPES = [
  { id: 'government', label: 'Government', hint: 'Public sector & national labs', icon: Landmark },
  { id: 'university', label: 'University', hint: 'Academic institutions', icon: GraduationCap },
  { id: 'private', label: 'Private enterprise', hint: 'Industry & corporates', icon: Building2 },
  { id: 'startup', label: 'Startup', hint: 'SME & venture teams', icon: Rocket },
  { id: 'research', label: 'Research lab', hint: 'Dedicated R&D facilities', icon: FlaskConical },
  { id: 'programme', label: 'National programme', hint: 'Consortium & funded programmes', icon: Network },
  { id: 'international', label: 'International', hint: 'Global agencies & institutions', icon: Globe2 },
  { id: 'ngo', label: 'NGO / non-profit', hint: 'Foundations & civil society', icon: HeartHandshake },
  { id: 'other', label: 'Other', hint: 'Custom organisation — name it below', icon: Layers },
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
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [facilityName, setFacilityName] = useState('')
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
  const [orgDialog, setOrgDialog] = useState(null)

  const selectedType = useMemo(
    () => ORG_TYPES.find((t) => t.id === selectedTypeId) || null,
    [selectedTypeId],
  );

  const registeredSet = useMemo(
    () => new Set(registeredOrgs.map(normOrg)),
    [registeredOrgs],
  );

  const orgValue = useMemo(() => {
    if (!selectedType || !facilityName.trim()) return '';
    return `${selectedType.label} · ${facilityName.trim()}`;
  }, [selectedType, facilityName]);

  useEffect(() => {
    let cancelled = false
    api.getRegistrationOptions()
      .then((reg) => {
        if (cancelled) return;
        setRegistrationOpen(reg?.allow_public_registration !== false);
        setRequiresAdminApproval(Boolean(reg?.require_admin_approval));
        setRegisteredOrgs(reg?.registered_orgs || []);
      })
      .catch(() => { if (!cancelled) setRegistrationOpen(true) })
      .finally(() => { if (!cancelled) setPolicyLoading(false) })
    return () => { cancelled = true }
  }, [])

  const pickType = (typeId) => {
    setError('');
    setSelectedTypeId(typeId);
    setFacilityName('');
    setFieldErrors((f) => ({ ...f, org: undefined }));
  };

  const clearType = () => {
    setSelectedTypeId('');
    setFacilityName('');
    setStep('profile');
    setError('');
    setFieldErrors({});
  };

  const checkFacilityDuplicate = (name) => {
    const full = selectedType ? `${selectedType.label} · ${name.trim()}` : name.trim();
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

  const validateDetails = () => {
    const next = {}
    if (!selectedTypeId) next.org = 'Choose an organisation type.'
    if (!facilityName.trim()) next.org = next.org || 'Enter your facility or programme name.'
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
        role: 'Operator',
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
    <>
      Already have an account? <Link to="/login">Sign in</Link>
    </>
  );

  const panelHead = (
    <header className="reg-cert-head">
      <h1>Create account</h1>
      <p>{COPY.auth.registerSubtitle}</p>
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

      {success ? (
        <p className="auth-inline-alert auth-inline-alert--success" role="status">{success}</p>
      ) : (
        <div className={`reg-stage${selectedTypeId ? ' reg-stage--detail' : ''}`}>
          <div className="reg-stage__brand">
            <img src={cdacLogo} alt="" className="reg-stage__logo" width={120} height={40} />
            <p className="reg-stage__wordmark">Q-TeleScope</p>
            <div className="reg-stage__fridge">
              <AuthFridgeVisual />
            </div>
          </div>

          {!selectedTypeId ? (
            <div className="reg-stage__types">
              <p className="reg-stage__label">Organisation type</p>
              <div className="reg-type-grid" role="listbox" aria-label="Organisation type">
                {ORG_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="reg-type-tile"
                      onClick={() => pickType(type.id)}
                    >
                      <span className="reg-type-tile__row">
                        <span className="reg-type-tile__icon-wrap" aria-hidden>
                          <Icon className="size-5 shrink-0" strokeWidth={2} />
                        </span>
                        <span className="reg-type-tile__title">{type.label}</span>
                      </span>
                      <span className="reg-type-tile__hint">{type.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <div className="reg-stage__form">
            {selectedType ? (
              <div className="reg-form-type-bar">
                <span className="reg-form-type-bar__chip">
                  {React.createElement(selectedType.icon, { className: 'size-4 shrink-0', 'aria-hidden': true })}
                  {selectedType.label}
                </span>
                <button type="button" className="reg-form-type-bar__back" onClick={clearType} disabled={busy}>
                  <ChevronLeft className="size-4" aria-hidden />
                  Change type
                </button>
              </div>
            ) : null}
            {step === 'otp' ? (
              <form onSubmit={handleConfirmOtp} className="reg-form-stack" noValidate>
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
                <div className="reg-form-actions">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => { setStep('profile'); setError(''); }}>
                    Back
                  </Button>
                  <Button type="submit" className="auth-cta reg-form-submit flex-1" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Verify
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSendOtp} className="reg-form-stack reg-form-stack--profile" noValidate>
                {requiresAdminApproval ? (
                  <p className="auth-register-approval-note" role="note">
                    After email verification, a platform administrator must approve your account before you can sign in. Roles are assigned in Administration → Users.
                  </p>
                ) : null}
                <Field
                  label={selectedTypeId === 'other' ? 'Organisation name' : 'Facility or programme'}
                  forId="reg-facility"
                  hint={fieldErrors.org}
                >
                  <input
                    id="reg-facility"
                    type="text"
                    className={`${fieldClass} ${fieldErrors.org ? 'auth-field--invalid' : ''}`}
                    placeholder={
                      selectedType
                        ? selectedTypeId === 'university'
                          ? 'e.g. IIT Bombay'
                          : selectedTypeId === 'other'
                            ? 'e.g. Open quantum consortium'
                            : 'e.g. Your unit name'
                        : ''
                    }
                    value={facilityName}
                    onChange={(e) => {
                      setFacilityName(e.target.value);
                      setFieldErrors((f) => ({ ...f, org: undefined }));
                      if (selectedType && checkFacilityDuplicate(e.target.value)) {
                        /* dialog shown */
                      }
                    }}
                    autoComplete="organization"
                    required
                  />
                </Field>

                <div className="reg-form-row reg-form-row--split">
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
                    className={`${fieldClass} ${fieldErrors.email ? 'auth-field--invalid' : ''}`}
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

                <Button type="submit" className="auth-cta reg-form-submit" disabled={busy || !orgValue}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Send verification code
                </Button>
              </form>
            )}
          </div>
          )}
        </div>
      )}
    </AuthShell>
  )
}