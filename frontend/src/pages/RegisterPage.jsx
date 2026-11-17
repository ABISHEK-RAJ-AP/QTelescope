import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, User, Lock, Mail, Building } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'
import { COPY } from '@/copy/operator.js'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!username.trim() || !email.trim() || !password) {
      setError('Fill username, email, and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!captchaCode.trim()) {
      setError('Enter the characters shown in the image.')
      return
    }

    setBusy(true)
    try {
      const res = await api.register({
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        email: email.trim(),
        org: org.trim() || 'C-DAC',
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      if (res?.status === 'SUCCESS') {
        markOnboardingPending(username.trim())
        setSuccess('Account created. Redirecting to sign in…')
        setTimeout(() => navigate('/login'), 1200)
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
      title="Create account"
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
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username" forId="reg-username">
            <div className="relative flex w-full items-center">
              <User className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
              <input
                id="reg-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${fieldClass} pl-8`}
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

        <Field label="Email" forId="reg-email">
          <div className="relative flex w-full items-center">
            <Mail className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${fieldClass} pl-8`}
            />
          </div>
        </Field>

        <Field label="Organisation" forId="reg-org">
          <div className="relative flex w-full items-center">
            <Building className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
            <input
              id="reg-org"
              type="text"
              autoComplete="organization"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              className={`${fieldClass} pl-8`}
            />
          </div>
        </Field>

        <Field label="Password" forId="reg-password" hint="Min. 6 characters">
          <div className="relative flex w-full items-center">
            <Lock className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
            <input
              id="reg-password"
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldClass} pl-8 pr-10`}
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

        <Field label="Confirm password" forId="reg-confirm">
          <div className="relative flex w-full items-center">
            <Lock className="pointer-events-none absolute left-1 size-4 text-neutral-400" aria-hidden />
            <input
              id="reg-confirm"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${fieldClass} pl-8`}
            />
          </div>
        </Field>

        <CaptchaField
          key={captchaKey}
          value={captchaCode}
          onChange={setCaptchaCode}
          onChallenge={setCaptchaId}
        />

        {error ? (
          <div className="auth-inline-alert auth-inline-alert--error" role="alert">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="auth-inline-alert auth-inline-alert--success" role="status">
            {success}
          </div>
        ) : null}

        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create account <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </AuthShell>
  )
}
