import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, User, Lock, Mail, Building, Briefcase } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { AuthBreadcrumb } from '@/components/AuthBreadcrumb'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'
import { COPY } from '@/copy/operator.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCESS_OPTIONS = [
  { value: 'Operator', label: 'Operations console', hint: 'Monitor fleet, alerts, incidents, calibration' },
  { value: 'Researcher', label: 'Research & analysis', hint: 'Read telemetry, exports, developer studio' },
];

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
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

  useEffect(() => {
    let cancelled = false
    api.getConfigStatus()
      .then((s) => { if (!cancelled) setRegistrationOpen(s?.allow_public_registration !== false) })
      .catch(() => { if (!cancelled) setRegistrationOpen(true) })
      .finally(() => { if (!cancelled) setPolicyLoading(false) })
    return () => { cancelled = true }
  }, [])

  const validate = () => {
    const next = {}
    const u = username.trim()
    if (!u || u.length < 3) next.username = 'Username must be at least 3 characters.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!org.trim()) next.org = 'Organisation name is required (your lab or facility).'
    if (!password) next.password = 'Password is required.'
    else if (password.length < 6) next.password = 'Password must be at least 6 characters.'
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.'
    if (!captchaCode.trim()) next.captcha = 'Enter the characters from the security image.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validate()) {
      setError('Fix the highlighted fields and try again.')
      return
    }

    setBusy(true)
    try {
      const res = await api.register({
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        email: email.trim(),
        org: org.trim(),
        role: access,
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      if (res?.status === 'SUCCESS') {
        markOnboardingPending(username.trim())
        setSuccess(res?.message || 'Account created. Redirecting to sign in…')
        setTimeout(() => navigate('/login'), 1400)
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.')
      setCaptchaKey((k) => k + 1)
      setCaptchaCode('')
    } finally {
      setBusy(false)
    }
  }

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

      {!policyLoading && !registrationOpen ? (
        <p className="text-sm text-[var(--text-muted)]" role="status">
          Public registration is disabled on this deployment.{' '}
          <Link to="/login" className="font-semibold text-[var(--accent)]">Sign in</Link> with an existing account
          or contact your administrator.
        </p>
      ) : (
      <form onSubmit={handleSubmit} className="auth-register-form space-y-4" noValidate>
        <ol className="auth-register-steps" aria-label="Registration steps">
          <li className="auth-register-steps__item auth-register-steps__item--active"><span>1</span> Identity</li>
          <li className="auth-register-steps__item auth-register-steps__item--active"><span>2</span> Organisation</li>
          <li className="auth-register-steps__item auth-register-steps__item--active"><span>3</span> Security</li>
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
              <input
                id="reg-org"
                type="text"
                required
                autoComplete="organization"
                placeholder="e.g. C-DAC Pune"
                value={org}
                onChange={(e) => { setOrg(e.target.value); setFieldErrors((f) => ({ ...f, org: undefined })); }}
                className={`${fieldClass} pl-8 ${fieldErrors.org ? 'auth-field--invalid' : ''}`}
                aria-invalid={fieldErrors.org ? true : undefined}
              />
            </div>
          </Field>

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

        {error ? (
          <div key={error} className="auth-inline-alert auth-inline-alert--error qt-shake" role="alert">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="auth-inline-alert auth-inline-alert--success" role="status">
            {success}
          </div>
        ) : null}

        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy || !!success}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create account <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
      )}
    </AuthShell>
  )
}