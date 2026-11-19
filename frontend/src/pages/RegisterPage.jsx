import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, User, Lock, Mail, Building, Briefcase, ShieldCheck } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { AuthBreadcrumb } from '@/components/AuthBreadcrumb'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'
import { notifyInfo } from '@/lib/toast'
import { COPY } from '@/copy/operator.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCESS_OPTIONS = [
  { value: 'Operator', label: 'Operations console', hint: 'Monitor fleet, alerts, incidents, calibration' },
  { value: 'Researcher', label: 'Research & analysis', hint: 'Read telemetry, exports, developer studio' },
];
const OTHER_ORG = 'Other — contact administrator';

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
        aria-label="Email verification code"
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [accessPath, setAccessPath] = useState('self')
  const [step, setStep] = useState('details')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [orgPick, setOrgPick] = useState('C-DAC')
  const [orgCustom, setOrgCustom] = useState('')
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
  const [requireAdminApproval, setRequireAdminApproval] = useState(false)
  const [orgOptions, setOrgOptions] = useState([])
  const [otpSessionId, setOtpSessionId] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpDelivery, setOtpDelivery] = useState('email')

  const orgValue = useMemo(() => {
    if (orgPick === OTHER_ORG) return orgCustom.trim();
    return orgPick.trim();
  }, [orgPick, orgCustom]);

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getConfigStatus(), api.getRegistrationOptions().catch(() => null)])
      .then(([s, reg]) => {
        if (cancelled) return;
        setRegistrationOpen(s?.allow_public_registration !== false);
        setRequireAdminApproval(Boolean(reg?.require_admin_approval ?? s?.registration_require_admin_approval));
        const opts = reg?.org_options?.length ? reg.org_options : (s?.registration_org_options || []);
        setOrgOptions(opts.length ? opts : ['C-DAC', 'C-DAC Pune', OTHER_ORG]);
        if (opts[0]) setOrgPick((prev) => prev || opts[0]);
      })
      .catch(() => { if (!cancelled) setRegistrationOpen(true) })
      .finally(() => { if (!cancelled) setPolicyLoading(false) })
    return () => { cancelled = true }
  }, [])

  const validateDetails = () => {
    const next = {}
    const u = username.trim()
    if (!u || u.length < 3) next.username = 'Username must be at least 3 characters.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!orgValue) next.org = 'Organisation name is required (your lab or facility).'
    if (!password) next.password = 'Password is required.'
    else if (password.length < 6) next.password = 'Password must be at least 6 characters.'
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.'
    if (!captchaCode.trim()) next.captcha = 'Enter the characters from the security image.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validateDetails()) {
      setError('Fix the highlighted fields and try again.')
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
      if (res?.status !== 'SUCCESS') {
        throw new Error(res?.message || 'Could not send verification code.')
      }
      setOtpSessionId(res.otp_session_id || '')
      setOtpDelivery(res.delivery || 'email')
      setStep('otp')
      setOtpCode('')
      if (res.delivery === 'screen' && res.screen_otp) {
        notifyInfo(`Verification code (demo): ${res.screen_otp}`, {
          toastId: 'register-otp-demo',
          autoClose: 45000,
        })
      } else {
        notifyInfo('Verification code sent to your email.', { autoClose: 8000 })
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
      setFieldErrors({ otp: 'Enter the full 6-digit code.' })
      setError('Enter the verification code.')
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
        setStep('done')
        setSuccess(res?.message || 'Account created.')
        setTimeout(() => navigate('/login'), res?.pending_admin_approval ? 2800 : 1600)
      }
    } catch (err) {
      setError(err?.message || 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const stepItems = [
    { key: 'details', label: 'Identity', active: step === 'details' || step === 'otp' || step === 'done' },
    { key: 'org', label: 'Organisation', active: step === 'details' || step === 'otp' || step === 'done' },
    { key: 'otp', label: 'Verify email', active: step === 'otp' || step === 'done' },
  ];

  return (
    <AuthShell
      title="Request console access"
      subtitle={COPY.auth.registerSubtitle}
      footer={
        <p className="text-center text-sm text-[var(--text-muted)]">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[var(--accent)] hover:opacity-90">
            Sign in
          </Link>
        </p>
      }
    >
      <AuthBreadcrumb items={[
        { label: 'Home', to: '/' },
        { label: 'Sign in', to: '/login' },
        { label: 'Create account' },
      ]} />

      <p className="auth-register-callout" role="note">
        {COPY.auth.registerHowItWorks}
      </p>

      <div className="auth-register-mode" role="tablist" aria-label="Registration path">
        <button
          type="button"
          role="tab"
          aria-selected={accessPath === 'self'}
          className={`auth-register-mode__btn${accessPath === 'self' ? ' auth-register-mode__btn--active' : ''}`}
          onClick={() => { setAccessPath('self'); setStep('details'); setError(''); }}
        >
          Request access
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={accessPath === 'invite'}
          className={`auth-register-mode__btn${accessPath === 'invite' ? ' auth-register-mode__btn--active' : ''}`}
          onClick={() => { setAccessPath('invite'); setError(''); }}
        >
          Invited by admin
        </button>
      </div>

      {!policyLoading && !registrationOpen ? (
        <p className="text-sm text-[var(--text-muted)]" role="status">
          Public registration is disabled on this deployment.{' '}
          <Link to="/login" className="font-semibold text-[var(--accent)]">Sign in</Link> with an existing account
          or contact your administrator.
        </p>
      ) : accessPath === 'invite' ? (
        <motionlessInvitePanel />
      ) : step === 'done' ? (
        <div className="auth-inline-alert auth-inline-alert--success auth-register-done" role="status">
          <ShieldCheck className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Request submitted</p>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      ) : step === 'otp' ? (
        <form onSubmit={handleConfirmOtp} className="auth-register-form space-y-4" noValidate>
          <ol className="auth-register-steps" aria-label="Registration steps">
            {stepItems.map((s) => (
              <li
                key={s.key}
                className={`auth-register-steps__item${s.active ? ' auth-register-steps__item--active' : ''}`}
              >
                <span>{stepItems.indexOf(s) + 1}</span> {s.label}
              </li>
            ))}
          </ol>
          <div className="auth-otp-panel">
            <p className="auth-otp-panel__title">Verify your email</p>
            <p className="auth-otp-panel__lead">
              {otpDelivery === 'screen'
                ? COPY.auth.registerOtpHint
                : `We sent a 6-digit code to ${email.trim()}.`}
            </p>
            <Field label="Verification code" forId="reg-otp" hint={fieldErrors.otp}>
              <OtpInput
                value={otpCode}
                onChange={(v) => { setOtpCode(v); setFieldErrors((f) => ({ ...f, otp: undefined })); }}
                disabled={busy}
                invalid={Boolean(fieldErrors.otp)}
              />
            </Field>
            {requireAdminApproval ? (
              <p className="auth-register-approval-note">
                After verification, your account will await administrator approval before sign-in.
              </p>
            ) : null}
          </div>
          {error ? (
            <div key={error} className="auth-inline-alert auth-inline-alert--error qt-shake" role="alert">
              {error}
            </div>
          ) : null}
          <motionableRegisterFooter
            busy={busy}
            primaryLabel="Confirm & create account"
            secondaryLabel="Back"
            onSecondary={() => { setStep('details'); setError(''); }}
          />
        </form>
      ) : (
      <form onSubmit={handleSendOtp} className="auth-register-form space-y-4" noValidate>
        <ol className="auth-register-steps" aria-label="Registration steps">
          <li className="auth-register-steps__item auth-register-steps__item--active"><span>1</span> Identity</li>
          <li className="auth-register-steps__item auth-register-steps__item--active"><span>2</span> Organisation</li>
          <li className="auth-register-steps__item"><span>3</span> Verify email</li>
        </ol>

        <fieldset className="auth-register-fieldset space-y-3">
          <legend className="auth-register-legend">Identity</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" forId="reg-username" hint={fieldErrors.username}>
              <div className="relative flex w-full items-center">
                <User className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
                <input
                  id="reg-username"
                  type="text"
                  required
                  minLength={3}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setFieldErrors((f) => ({ ...f, username: undefined })); }}
                  className={`${fieldClass} pl-8 ${fieldErrors.username ? 'auth-field--invalid' : ''}`}
                  aria-invalid={fieldErrors.username ? true : undefined}
                />
              </div>
            </Field>
            <Field label="Full name" forId="reg-fullname">
              <input
                id="reg-fullname"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>

          <Field label="Email" forId="reg-email" hint={fieldErrors.email}>
            <div className="relative flex w-full items-center">
              <Mail className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
                className={`${fieldClass} pl-8 ${fieldErrors.email ? 'auth-field--invalid' : ''}`}
                aria-invalid={fieldErrors.email ? true : undefined}
              />
            </div>
          </Field>
        </fieldset>

        <fieldset className="auth-register-fieldset space-y-3">
          <legend className="auth-register-legend">Organisation & access</legend>
          <Field label="Organisation" forId="reg-org" hint={fieldErrors.org || COPY.auth.registerOrgHint}>
            <div className="relative flex w-full items-center">
              <Building className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
              <select
                id="reg-org"
                className={`${fieldClass} pl-8 ${fieldErrors.org ? 'auth-field--invalid' : ''}`}
                value={orgPick}
                onChange={(e) => { setOrgPick(e.target.value); setFieldErrors((f) => ({ ...f, org: undefined })); }}
                aria-invalid={fieldErrors.org ? true : undefined}
              >
                {(orgOptions.length ? orgOptions : ['C-DAC', OTHER_ORG]).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </Field>
          {orgPick === OTHER_ORG ? (
            <Field label="Organisation name" forId="reg-org-custom" hint={fieldErrors.org}>
              <input
                id="reg-org-custom"
                type="text"
                className={`${fieldClass} ${fieldErrors.org ? 'auth-field--invalid' : ''}`}
                value={orgCustom}
                onChange={(e) => { setOrgCustom(e.target.value); setFieldErrors((f) => ({ ...f, org: undefined })); }}
                placeholder="Lab or facility name"
                autoComplete="organization"
              />
            </Field>
          ) : null}

          <Field label="Requested access" forId="reg-access" hint={COPY.auth.registerAccessHint}>
            <div className="relative flex w-full items-center">
              <Briefcase className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
              <select
                id="reg-access"
                className={`${fieldClass} pl-8`}
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              >
                {ACCESS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="auth-register-access-hint">{ACCESS_OPTIONS.find((o) => o.value === access)?.hint}</p>
          </Field>
        </fieldset>

        <fieldset className="auth-register-fieldset space-y-3">
          <legend className="auth-register-legend">Security</legend>
          <Field label="Password" forId="reg-password" hint={fieldErrors.password || 'Min. 6 characters'}>
            <div className="relative flex w-full items-center">
              <Lock className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
              <input
                id="reg-password"
                type={showPw ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
                className={`${fieldClass} pl-8 pr-10 ${fieldErrors.password ? 'auth-field--invalid' : ''}`}
                aria-invalid={fieldErrors.password ? true : undefined}
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm password" forId="reg-confirm" hint={fieldErrors.confirmPassword}>
            <div className="relative flex w-full items-center">
              <Lock className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
              <input
                id="reg-confirm"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((f) => ({ ...f, confirmPassword: undefined })); }}
                className={`${fieldClass} pl-8 ${fieldErrors.confirmPassword ? 'auth-field--invalid' : ''}`}
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
              />
            </div>
          </Field>

          <CaptchaField
            key={captchaKey}
            value={captchaCode}
            onChange={(v) => { setCaptchaCode(v); setFieldErrors((f) => ({ ...f, captcha: undefined })); }}
            onChallenge={setCaptchaId}
          />
          {fieldErrors.captcha ? <p className="auth-field-error">{fieldErrors.captcha}</p> : null}
        </fieldset>

        {requireAdminApproval ? (
          <p className="auth-register-approval-note">Administrator approval is required on this deployment after email verification.</p>
        ) : null}

        {error ? (
          <div key={error} className="auth-inline-alert auth-inline-alert--error qt-shake" role="alert">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Continue — verify email <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
      )}
    </AuthShell>
  )
}

function motionlessInvitePanel() {
  return (
    <div className="auth-register-invite card space-y-3 p-4">
      <p className="text-sm text-[var(--text-muted)]">{COPY.auth.registerInviteHint}</p>
      <p className="text-sm">
        Use the username and temporary password from your administrator, then complete MFA if prompted.
      </p>
      <Link to="/login" className="auth-cta inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold">
        Go to sign in <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function motionableRegisterFooter({ busy, primaryLabel, secondaryLabel, onSecondary }) {
  return (
    <div className="auth-register-actions">
      <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onSecondary}>
        {secondaryLabel}
      </Button>
      <Button type="submit" className="auth-cta h-11 flex-1 gap-2 text-sm font-semibold" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {primaryLabel} <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}